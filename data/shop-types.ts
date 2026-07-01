// ============================================================
// data/shop-types.ts — 商城前台 view 型別（client + server 共用）
// ------------------------------------------------------------
// 純型別，無 runtime import，可安全被 client component 引用
// （queries.ts 是 server-only、shop.ts 是 'use server' 都不能匯出型別）。
// ============================================================

export type StoreColor = { name: string; hex: string }
export type StoreVariant = { size: string | null; color: string | null; stock: number }
export type StoreCategory = { id: string; name: string; slug: string }

export type StoreProduct = {
  id: string
  name: string
  unitPrice: number
  /** 原價（劃線價）；null = 無特價 */
  compareAtPrice: number | null
  onlineStock: number
  isListed: boolean
  description: string
  emoji: string
  /** 第一張圖（無圖為 null → 前台用品牌佔位圖） */
  imageUrl: string | null
  images: string[]
  sizes: string[]
  colors: StoreColor[]
  variants: StoreVariant[]
  categories: StoreCategory[]
}
