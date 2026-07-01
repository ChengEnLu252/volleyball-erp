'use server'

// ============================================================
// app/actions/orders-admin.ts — 後台訂單管理（SC3）
// ------------------------------------------------------------
// owner 全部訂單；manager 自己館「到館自取」訂單；staff 擋。
// 訂單狀態流（標記已付款 / 完成＋物流 / 取消回補）、商城庫存（調庫存 / 上下架）、代客下單。
// ============================================================

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, type UserScope,
  getOrdersForUserAsync, getOrderCountsForUserAsync,
  getShopInventoryAsync, getShopStorefrontAsync,
  createShopOrderAsync, restockOrderItemsAsync,
} from '@/data/server/queries'
import type { AdminOrder, OrderStatus, StoreProduct, PlaceOrderInput } from '@/data/shop-types'

type Fail = { ok: false; reason: string }
type Ok = { ok: true }

async function requireStaff(): Promise<{ scope: UserScope } | Fail> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, reason: '無權限（限館長／老闆）' }
  return { scope }
}

function canManageOrder(scope: UserScope, order: { fulfillment: string; pickupVenueId: string | null }): boolean {
  if (scope.visibleVenueIds === 'all') return true
  return order.fulfillment === 'pickup' && !!order.pickupVenueId && scope.visibleVenueIds.includes(order.pickupVenueId)
}

// —— 載入 ——
export async function loadOrdersAdminAction(args: { status?: OrderStatus }): Promise<
  { ok: true; role: 'owner' | 'manager'; orders: AdminOrder[]; counts: Record<OrderStatus, number> } | Fail
> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const { scope } = g
  const [orders, counts] = await Promise.all([
    getOrdersForUserAsync(scope, args?.status),
    getOrderCountsForUserAsync(scope),
  ])
  return { ok: true, role: scope.role as 'owner' | 'manager', orders, counts }
}

export async function loadComposeDataAction(): Promise<{ ok: true; venues: { id: string; name: string }[]; products: StoreProduct[] } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const [venues, sf] = await Promise.all([
    prisma.venue.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getShopStorefrontAsync(),
  ])
  return { ok: true, venues, products: sf.products }
}

export async function loadShopInventoryAction(): Promise<{ ok: true; products: StoreProduct[] } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  return { ok: true, products: await getShopInventoryAsync() }
}

// —— 訂單狀態流 ——
export async function markOrderPaidAction(orderId: string): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, reason: '找不到訂單' }
  if (!canManageOrder(g.scope, order)) return { ok: false, reason: '無權操作此訂單' }
  if (order.status !== 'pending') return { ok: false, reason: '僅「待處理」訂單可標記已付款' }
  await prisma.order.update({ where: { id: orderId }, data: { status: 'paid', paidAt: new Date() } })
  return { ok: true }
}

export async function fulfillOrderAction(args: { orderId: string; trackingNumber?: string; shippingProvider?: string }): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const order = await prisma.order.findUnique({ where: { id: args.orderId } })
  if (!order) return { ok: false, reason: '找不到訂單' }
  if (!canManageOrder(g.scope, order)) return { ok: false, reason: '無權操作此訂單' }
  if (order.status !== 'pending' && order.status !== 'paid') return { ok: false, reason: '此訂單狀態無法標記完成' }
  const isShipping = order.fulfillment === 'shipping'
  await prisma.order.update({
    where: { id: args.orderId },
    data: {
      status: 'fulfilled', fulfilledAt: new Date(),
      ...(isShipping ? {
        trackingNumber: args.trackingNumber?.trim() || null,
        shippingProvider: args.shippingProvider?.trim() || null,
        shippedAt: new Date(),
      } : {}),
    },
  })
  return { ok: true }
}

export async function cancelOrderAction(args: { orderId: string; reason: string }): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const order = await prisma.order.findUnique({ where: { id: args.orderId } })
  if (!order) return { ok: false, reason: '找不到訂單' }
  if (!canManageOrder(g.scope, order)) return { ok: false, reason: '無權操作此訂單' }
  if (order.status === 'cancelled' || order.status === 'fulfilled') return { ok: false, reason: '已完成 / 已取消的訂單不可取消' }
  await prisma.$transaction(async (tx) => {
    await restockOrderItemsAsync(tx, args.orderId)
    await tx.order.update({ where: { id: args.orderId }, data: { status: 'cancelled', cancelReason: args.reason?.trim() || null, cancelledAt: new Date() } })
  })
  return { ok: true }
}

// —— 商城庫存 ——
export async function adjustShopStockAction(args: { productId: string; newStock: number }): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const p = await prisma.shopProduct.findUnique({ where: { id: args.productId }, include: { variants: true } })
  if (!p) return { ok: false, reason: '找不到商品' }
  if (p.variants.length > 0) return { ok: false, reason: '規格商品請逐一規格設定庫存' }
  await prisma.shopProduct.update({ where: { id: args.productId }, data: { onlineStock: Math.max(0, Math.floor(args.newStock)) } })
  return { ok: true }
}

export async function adjustShopVariantStockAction(args: { productId: string; size: string | null; color: string | null; newStock: number }): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  try {
    await prisma.$transaction(async (tx) => {
      const v = await tx.shopProductVariant.findFirst({ where: { shopProductId: args.productId, size: args.size ?? null, color: args.color ?? null } })
      if (!v) throw new Error('NOVARIANT')
      await tx.shopProductVariant.update({ where: { id: v.id }, data: { stock: Math.max(0, Math.floor(args.newStock)) } })
      const agg = await tx.shopProductVariant.aggregate({ where: { shopProductId: args.productId }, _sum: { stock: true } })
      await tx.shopProduct.update({ where: { id: args.productId }, data: { onlineStock: agg._sum.stock ?? 0 } })
    })
  } catch {
    return { ok: false, reason: '找不到此規格' }
  }
  return { ok: true }
}

export async function toggleShopListingAction(args: { productId: string; isListed: boolean }): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const p = await prisma.shopProduct.findUnique({ where: { id: args.productId }, select: { id: true } })
  if (!p) return { ok: false, reason: '找不到商品' }
  await prisma.shopProduct.update({ where: { id: args.productId }, data: { isListed: !!args.isListed } })
  return { ok: true }
}

// —— 代客下單 ——
export async function composeBackendOrderAction(input: PlaceOrderInput): Promise<{ ok: true; orderId: string; orderNo: string } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  return createShopOrderAsync(input, { channel: 'backend', placedByUserId: g.scope.userId })
}
