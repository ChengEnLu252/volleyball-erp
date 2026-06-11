'use client'

// ============================================================
// components/shop/cart.ts — 線上商城購物車（前端狀態）
// ============================================================
// 階段 17 新增。
//
// 購物車是「純前端」狀態，與 ERP 的 data/store 分開：
//   - 存在 localStorage（重整不丟），key 與 ERP diff 不同。
//   - shape：{ [shopProductId]: quantity }
//   - pub/sub + useSyncExternalStore → 任何元件 useCart() 都會即時同步。
//
// 下單成立後由 checkout 頁呼叫 clearCart()。
// 真正的庫存 / 訂單寫入走 data/api 的 createOrder（那邊才落 ERP store）。
// ============================================================

import { useSyncExternalStore } from 'react'

const CART_KEY = 'volleyops-shop-cart-v1'

type CartMap = Record<string, number>

/** 穩定的空購物車參照（SSR / 初次水合用，避免每次回傳新物件造成無限迴圈 / 水合不一致） */
const EMPTY: CartMap = {}

let cache: CartMap | null = null
const listeners = new Set<() => void>()

function read(): CartMap {
  // 伺服器端永遠回傳同一個穩定空物件（不寫入 cache，讓 client 端自行從 localStorage 讀）
  if (typeof window === 'undefined') return EMPTY
  if (cache) return cache
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    cache = raw ? (JSON.parse(raw) as CartMap) : {}
  } catch {
    cache = {}
  }
  return cache
}

function write(next: CartMap): void {
  cache = next
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(next)) } catch { /* quota / private mode */ }
  }
  for (const l of listeners) l()
}

// ── public mutations ─────────────────────────────────────────

/** 設定某商品數量（<=0 視為移除）。 */
export function setQty(productId: string, qty: number): void {
  const cur = { ...read() }
  if (qty <= 0) delete cur[productId]
  else cur[productId] = Math.floor(qty)
  write(cur)
}

/** 增 / 減某商品數量（delta 可為負）。 */
export function addToCart(productId: string, delta = 1): void {
  const cur = read()
  setQty(productId, (cur[productId] ?? 0) + delta)
}

/** 清空購物車（下單成立後呼叫）。 */
export function clearCart(): void {
  write({})
}

// ── public reads ─────────────────────────────────────────────

export function getCart(): CartMap {
  return read()
}

/** 購物車內不重複商品數 */
export function getCartLineCount(): number {
  return Object.keys(read()).length
}

/** 購物車內商品總件數 */
export function getCartItemCount(): number {
  return Object.values(read()).reduce((s, q) => s + q, 0)
}

// ── subscription / hook ──────────────────────────────────────

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** React hook：回傳目前購物車 map（會即時同步）。 */
export function useCart(): CartMap {
  return useSyncExternalStore(
    subscribe,
    read,
    () => EMPTY,
  )
}
