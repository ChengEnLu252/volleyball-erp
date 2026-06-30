'use server'

// ============================================================
// app/actions/products.ts — 商品檢視 / 流向 / 對帳載入（P2.4a，read-only）
// ------------------------------------------------------------
// 商品頁與商品對帳頁改 client 自取（避免 server-only 進 client bundle，且
// reconciliation/products 被 collections 分頁 hub 嵌入）。
// 目前 demo 無「販售/贈送/盤點」互動 UI（皆 seed 資料）→ 此檔僅讀取。
// ============================================================

import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, getVenuesForUserAsync, getVenueProductsForUserAsync, getProductTransactionsForUserAsync,
  getProductReconciliationForUserAsync,
  type VenueProductGroup, type ProductReconRow,
} from '@/data/server/queries'

type Tx = Awaited<ReturnType<typeof getProductTransactionsForUserAsync>>

export type ProductsViewBundle = { ok: true; venueProducts: VenueProductGroup[]; transactions: Tx } | { ok: false }

export async function loadProductsViewAction(): Promise<ProductsViewBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }
  const [venueProducts, transactions] = await Promise.all([
    getVenueProductsForUserAsync(scope),
    getProductTransactionsForUserAsync(scope),
  ])
  return { ok: true, venueProducts, transactions }
}

export type ProductReconBundle = { ok: true; products: ProductReconRow[]; venues: { id: string; name: string }[] } | { ok: false }

export async function loadProductReconciliationAction(): Promise<ProductReconBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }
  const [products, venuesAll] = await Promise.all([
    getProductReconciliationForUserAsync(scope),
    getVenuesForUserAsync(scope),
  ])
  const venues = venuesAll.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  return { ok: true, products, venues }
}
