// ============================================================
// components/shop/variants.ts — 商品規格 / 購物車 key 工具
// ============================================================
// 階段 21 新增（尺寸 × 顏色規格）。
//
// 購物車 key 編碼：
//   - 無規格商品：key 就是 productId（沿用舊版，舊購物車不會壞）。
//   - 有規格商品：key = `${productId}::${size}::${color}`。
//
// 這裡只放純函式，前後台共用。
// ============================================================

import type { ShopProduct, ShopVariant } from '@/types'

const SEP = '::'

/** 某商品是否有規格（尺寸 / 顏色）。 */
export function hasVariants(p: Pick<ShopProduct, 'variants'>): boolean {
  return p.variants.length > 0
}

/** 組購物車 key。size / color 任一為 null/'' 代表該軸不存在。 */
export function cartKey(productId: string, size?: string | null, color?: string | null): string {
  if (!size && !color) return productId
  return `${productId}${SEP}${size ?? ''}${SEP}${color ?? ''}`
}

/** 解析購物車 key → { productId, size, color }。舊版 bare key 視為無規格。 */
export function parseCartKey(key: string): { productId: string; size: string | null; color: string | null } {
  if (!key.includes(SEP)) return { productId: key, size: null, color: null }
  const [productId, size, color] = key.split(SEP)
  return { productId, size: size || null, color: color || null }
}

/** 找出對應 (size, color) 的規格。找不到回 null。 */
export function findVariant(
  p: Pick<ShopProduct, 'variants'>,
  size: string | null,
  color: string | null,
): ShopVariant | null {
  return p.variants.find(v => (v.size ?? null) === (size ?? null) && (v.color ?? null) === (color ?? null)) ?? null
}

/**
 * 取得某 (size, color) 的可購庫存。
 *   - 有規格商品：回該規格庫存（找不到回 0）。
 *   - 無規格商品：回 onlineStock。
 */
export function stockFor(
  p: Pick<ShopProduct, 'variants' | 'onlineStock'>,
  size: string | null,
  color: string | null,
): number {
  if (p.variants.length === 0) return p.onlineStock
  return findVariant(p, size, color)?.stock ?? 0
}

/** 規格的可讀標籤，例：「M・櫻花粉」；皆無回空字串。 */
export function variantLabel(size?: string | null, color?: string | null): string {
  return [size, color].filter(Boolean).join('・')
}
