'use server'

// ============================================================
// app/actions/shop-admin.ts — 後台商品管理（SC2）
// ------------------------------------------------------------
// owner / manager 可管理單一商城的商品：新增 / 編輯 / 刪除、
// 規格矩陣（尺寸×顏色 各庫存+SKU）、分類指派、圖片、上下架、原價/特價。
// staff 擋。
// ============================================================

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope,
  getShopInventoryAsync, getShopAdminProductAsync, getAllShopCategoriesAsync,
} from '@/data/server/queries'
import type { StoreProduct, StoreCategory, ShopProductSaveInput } from '@/data/shop-types'

type Fail = { ok: false; reason: string }

async function requireStaff(): Promise<{ userId: string } | Fail> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, reason: '無權限（限館長／老闆）' }
  return { userId: scope.userId }
}

const intAtLeast = (n: unknown, min: number) => { const v = Math.floor(Number(n)); return Number.isFinite(v) ? Math.max(min, v) : min }

// —— 載入 ——
export async function loadShopAdminAction(): Promise<{ ok: true; products: StoreProduct[]; categories: StoreCategory[] } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const [products, categories] = await Promise.all([getShopInventoryAsync(), getAllShopCategoriesAsync()])
  return { ok: true, products, categories }
}

export async function loadShopAdminProductAction(id: string): Promise<{ ok: true; product: StoreProduct | null } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  return { ok: true, product: await getShopAdminProductAsync(id) }
}

// —— 新增 / 編輯 ——
export async function saveShopProductAction(input: ShopProductSaveInput): Promise<{ ok: true; id: string } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g

  const name = (input?.name ?? '').trim()
  if (!name) return { ok: false, reason: '請填寫商品名稱' }
  const unitPrice = intAtLeast(input.unitPrice, 0)
  const compareAtPrice = input.compareAtPrice != null && input.compareAtPrice > unitPrice ? Math.floor(input.compareAtPrice) : null

  const sizes = (input.sizes ?? []).map((s) => s.trim()).filter(Boolean)
  const colors = (input.colors ?? []).filter((c) => c && c.name.trim()).map((c) => ({ name: c.name.trim(), hex: c.hex || '#d1d5db' }))
  const hasAxes = sizes.length > 0 || colors.length > 0

  // 規格矩陣（去重 size|color；合併庫存）
  const variantMap = new Map<string, { size: string | null; color: string | null; stock: number; sku: string | null }>()
  if (hasAxes) {
    for (const v of input.variants ?? []) {
      const size = v.size?.trim() || null
      const color = v.color?.trim() || null
      // 只收在 sizes/colors 軸內的組合
      if (size && !sizes.includes(size)) continue
      if (color && !colors.some((c) => c.name === color)) continue
      const key = `${size ?? ''}|${color ?? ''}`
      const cur = variantMap.get(key)
      if (cur) cur.stock += intAtLeast(v.stock, 0)
      else variantMap.set(key, { size, color, stock: intAtLeast(v.stock, 0), sku: v.sku?.trim() || null })
    }
  }
  const variants = [...variantMap.values()]
  const onlineStock = hasAxes ? variants.reduce((s, v) => s + v.stock, 0) : intAtLeast(input.onlineStock, 0)

  const images = (input.images ?? []).map((u) => u.trim()).filter(Boolean)
  const categoryIds = [...new Set((input.categoryIds ?? []).filter(Boolean))]

  const scalar = {
    name, unitPrice, compareAtPrice, onlineStock,
    isListed: !!input.isListed,
    description: (input.description ?? '').trim(),
    emoji: (input.emoji ?? '').trim() || '🏐',
    sizes, colors: colors as unknown as Prisma.InputJsonValue,
  }

  try {
    if (input.id) {
      // —— 編輯：更新 scalar + 重建子表 ——
      const exists = await prisma.shopProduct.findUnique({ where: { id: input.id }, select: { id: true } })
      if (!exists) return { ok: false, reason: '找不到商品' }
      await prisma.$transaction(async (tx) => {
        await tx.shopProduct.update({ where: { id: input.id }, data: scalar })
        await tx.shopProductImage.deleteMany({ where: { shopProductId: input.id } })
        await tx.shopProductVariant.deleteMany({ where: { shopProductId: input.id } })
        await tx.shopProductCategory.deleteMany({ where: { shopProductId: input.id } })
        if (images.length) await tx.shopProductImage.createMany({ data: images.map((url, i) => ({ shopProductId: input.id as string, url, sortOrder: i })) })
        if (variants.length) await tx.shopProductVariant.createMany({ data: variants.map((v) => ({ shopProductId: input.id as string, size: v.size, color: v.color, stock: v.stock, sku: v.sku })) })
        if (categoryIds.length) await tx.shopProductCategory.createMany({ data: categoryIds.map((categoryId) => ({ shopProductId: input.id as string, categoryId })), skipDuplicates: true })
      })
      return { ok: true, id: input.id }
    }

    // —— 新增 ——
    const created = await prisma.shopProduct.create({
      data: {
        ...scalar,
        images: images.length ? { create: images.map((url, i) => ({ url, sortOrder: i })) } : undefined,
        variants: variants.length ? { create: variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock, sku: v.sku })) } : undefined,
        categories: categoryIds.length ? { create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      },
      select: { id: true },
    })
    return { ok: true, id: created.id }
  } catch {
    return { ok: false, reason: '儲存失敗，請稍後再試' }
  }
}

// —— 刪除（cascade 連同規格/圖/分類）——
export async function deleteShopProductAction(id: string): Promise<{ ok: true } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const p = await prisma.shopProduct.findUnique({ where: { id }, select: { id: true } })
  if (!p) return { ok: false, reason: '找不到商品' }
  try {
    await prisma.shopProduct.delete({ where: { id } })
    return { ok: true }
  } catch {
    return { ok: false, reason: '刪除失敗' }
  }
}

// —— 新增分類 ——
function slugify(name: string): string {
  const s = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-一-鿿]/g, '')
  return s || 'cat'
}

export async function createShopCategoryAction(args: { name: string }): Promise<{ ok: true; category: StoreCategory } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const name = (args?.name ?? '').trim()
  if (!name) return { ok: false, reason: '請填寫分類名稱' }
  const max = await prisma.shopCategory.aggregate({ _max: { sortOrder: true } })
  const base = slugify(name)
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    try {
      const c = await prisma.shopCategory.create({ data: { name, slug, sortOrder: (max._max.sortOrder ?? 0) + 1 } })
      return { ok: true, category: { id: c.id, name: c.name, slug: c.slug } }
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') continue
      return { ok: false, reason: '建立分類失敗' }
    }
  }
  return { ok: false, reason: '分類 slug 重複，請換個名稱' }
}
