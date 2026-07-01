'use server'

// ============================================================
// app/actions/shop.ts — 線上商城前台（公開，無登入）
// ------------------------------------------------------------
// SC4/SC5：前台讀真 DB + 下單。商城是公開頁（ChromeShell 白名單），
// 這些 action 不掛 user session。client 自取模式避免把 server-only
// queries 直接 import 進 client bundle。
// ============================================================

import {
  getShopStorefrontAsync,
  getShopProductViewAsync,
  getCheckoutDataAsync,
  getOrderViewAsync,
  lookupOrderViewAsync,
  createShopOrderAsync,
  type StoreProduct,
  type StoreCategory,
} from '@/data/server/queries'
import type { OrderView, PlaceOrderInput } from '@/data/shop-types'

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

type PlaceResult = { ok: true; orderId: string; orderNo: string } | { ok: false; reason: string }

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceResult> {
  return createShopOrderAsync(input, { channel: 'online', placedByUserId: null })
}
