'use server'

// ============================================================
// app/actions/shop.ts — 線上商城前台（公開，無登入）
// ------------------------------------------------------------
// SC4：前台改讀真 DB。商城是公開頁（ChromeShell 白名單、無 ERP 閘門），
// 這些 action 不掛 user session；只回上架商品。
// client 自取模式：page.tsx 是 client component，載入時呼叫這些 action，
// 避免把 server-only queries 直接 import 進 client bundle。
// ============================================================

import { prisma } from '@/lib/prisma'
import {
  getShopStorefrontAsync,
  getShopProductViewAsync,
  getCheckoutDataAsync,
  getOrderViewAsync,
  lookupOrderViewAsync,
  type StoreProduct,
  type StoreCategory,
} from '@/data/server/queries'
import {
  SHOP_SHIPPING_FEE,
  type OrderView,
  type PlaceOrderInput,
} from '@/data/shop-types'

export async function loadStorefrontAction(): Promise<{ categories: StoreCategory[]; products: StoreProduct[] }> {
  return getShopStorefrontAsync()
}

export async function loadShopProductAction(id: string): Promise<StoreProduct | null> {
  if (!id) return null
  return getShopProductViewAsync(id)
}

export async function loadCheckoutDataAction(productIds: string[]): Promise<{ venues: { id: string; name: string }[]; products: StoreProduct[] }> {
  return getCheckoutDataAsync(Array.isArray(productIds) ? productIds : [])
}

export async function loadOrderAction(id: string): Promise<OrderView | null> {
  return getOrderViewAsync(id)
}

export async function lookupOrderAction(args: { orderNo: string; phone: string }): Promise<OrderView | null> {
  return lookupOrderViewAsync(args?.orderNo ?? '', args?.phone ?? '')
}

// —— 下單（公開；扣庫存 + 建單）——
type PlaceResult = { ok: true; orderId: string; orderNo: string } | { ok: false; reason: string }

function genOrderNo(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `SH-${ymd}-${rand}`
}

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceResult> {
  // —— 基本驗證 ——
  const name = (input?.customerName ?? '').trim()
  const phone = (input?.customerPhone ?? '').trim()
  if (!name) return { ok: false, reason: '請填寫姓名' }
  if (!phone) return { ok: false, reason: '請填寫電話' }
  if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false, reason: '購物車是空的' }
  if (input.fulfillment === 'pickup' && !input.pickupVenueId) return { ok: false, reason: '請選擇取貨球館' }
  if (input.fulfillment === 'shipping') {
    const s = input.shipping
    if (!s || !s.recipient.trim() || !s.phone.trim() || !s.address.trim()) return { ok: false, reason: '請填寫完整收件資訊' }
  }

  // —— 合併同商品同規格 ——
  const merged = new Map<string, { productId: string; size: string | null; color: string | null; quantity: number }>()
  for (const it of input.items) {
    const q = Math.floor(Number(it.quantity))
    if (!it.productId || !Number.isFinite(q) || q <= 0) continue
    const size = it.size ?? null, color = it.color ?? null
    const key = `${it.productId}|${size ?? ''}|${color ?? ''}`
    const prev = merged.get(key)
    if (prev) prev.quantity += q
    else merged.set(key, { productId: it.productId, size, color, quantity: q })
  }
  if (merged.size === 0) return { ok: false, reason: '購物車是空的' }

  // —— Phase A：讀取 + 驗證（好錯誤訊息）——
  const productIds = [...new Set([...merged.values()].map((m) => m.productId))]
  const products = await prisma.shopProduct.findMany({
    where: { id: { in: productIds } },
    include: { variants: true, images: { orderBy: { sortOrder: 'asc' } } },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  type Op = { productId: string; variantId: string | null; qty: number }
  const ops: Op[] = []
  const orderItems: { productId: string; name: string; unitPrice: number; quantity: number; subtotal: number; size: string | null; color: string | null; imageUrl: string | null }[] = []

  for (const { productId, size, color, quantity } of merged.values()) {
    const p = byId.get(productId)
    if (!p || !p.isListed) return { ok: false, reason: '部分商品已下架，請重新整理購物車' }
    const spec = [size, color].filter(Boolean).join('・')
    let variantId: string | null = null
    if (p.variants.length > 0) {
      const v = p.variants.find((x) => (x.size ?? null) === size && (x.color ?? null) === color)
      if (!v) return { ok: false, reason: `「${p.name}」請選擇尺寸 / 顏色` }
      if (quantity > v.stock) return { ok: false, reason: `「${p.name}${spec ? `（${spec}）` : ''}」庫存不足（剩 ${v.stock}）` }
      variantId = v.id
    } else {
      if (quantity > p.onlineStock) return { ok: false, reason: `「${p.name}」庫存不足（剩 ${p.onlineStock}）` }
    }
    ops.push({ productId: p.id, variantId, qty: quantity })
    orderItems.push({
      productId: p.id, name: p.name, unitPrice: p.unitPrice, quantity, subtotal: p.unitPrice * quantity,
      size, color, imageUrl: p.images[0]?.url ?? null,
    })
  }

  const itemTotal = orderItems.reduce((s, it) => s + it.subtotal, 0)
  const shippingFee = input.fulfillment === 'shipping' ? SHOP_SHIPPING_FEE : 0
  const total = itemTotal + shippingFee

  // —— Phase B：交易內守衛式扣庫存 + 建單（含 orderNo 唯一重試）——
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const orderNo = genOrderNo()
      const created = await prisma.$transaction(async (tx) => {
        for (const op of ops) {
          if (op.variantId) {
            const r = await tx.shopProductVariant.updateMany({ where: { id: op.variantId, stock: { gte: op.qty } }, data: { stock: { decrement: op.qty } } })
            if (r.count === 0) throw new Error('OUT_OF_STOCK')
          } else {
            const r = await tx.shopProduct.updateMany({ where: { id: op.productId, onlineStock: { gte: op.qty } }, data: { onlineStock: { decrement: op.qty } } })
            if (r.count === 0) throw new Error('OUT_OF_STOCK')
          }
        }
        // 有規格商品：重算 onlineStock = 各規格加總
        const variantProductIds = [...new Set(ops.filter((o) => o.variantId).map((o) => o.productId))]
        for (const pid of variantProductIds) {
          const agg = await tx.shopProductVariant.aggregate({ where: { shopProductId: pid }, _sum: { stock: true } })
          await tx.shopProduct.update({ where: { id: pid }, data: { onlineStock: agg._sum.stock ?? 0 } })
        }
        return tx.order.create({
          data: {
            orderNo, channel: 'online',
            customerName: name, customerPhone: phone, customerEmail: input.customerEmail?.trim() || null,
            itemTotal, shippingFee, total,
            fulfillment: input.fulfillment,
            pickupVenueId: input.fulfillment === 'pickup' ? input.pickupVenueId : null,
            shipping: input.fulfillment === 'shipping'
              ? ({ recipient: input.shipping!.recipient.trim() || name, phone: input.shipping!.phone.trim() || phone, address: input.shipping!.address.trim() } as unknown as object)
              : undefined,
            paymentChannel: input.paymentChannel,
            status: 'pending', notes: input.notes?.trim() || null,
            items: { create: orderItems },
          },
        })
      })
      return { ok: true, orderId: created.id, orderNo: created.orderNo }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'OUT_OF_STOCK') return { ok: false, reason: '部分商品剛剛售出，請重新整理購物車' }
      // orderNo 撞號（P2002）→ 換號重試
      if (msg.includes('Unique constraint') || (e as { code?: string })?.code === 'P2002') continue
      return { ok: false, reason: '下單失敗，請稍後再試' }
    }
  }
  return { ok: false, reason: '下單失敗，請稍後再試' }
}
