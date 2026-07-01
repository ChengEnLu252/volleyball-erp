'use server'

// ============================================================
// app/actions/shop.ts — 線上商城前台（公開，無登入）
// ------------------------------------------------------------
// SC4：前台改讀真 DB。商城是公開頁（ChromeShell 白名單、無 ERP 閘門），
// 這些 action 不掛 user session；只回上架商品。
// client 自取模式：page.tsx 是 client component，載入時呼叫這些 action，
// 避免把 server-only queries 直接 import 進 client bundle。
// ============================================================

import {
  getShopStorefrontAsync,
  getShopProductViewAsync,
  type StoreProduct,
  type StoreCategory,
} from '@/data/server/queries'

export async function loadStorefrontAction(): Promise<{ categories: StoreCategory[]; products: StoreProduct[] }> {
  return getShopStorefrontAsync()
}

export async function loadShopProductAction(id: string): Promise<StoreProduct | null> {
  if (!id) return null
  return getShopProductViewAsync(id)
}
