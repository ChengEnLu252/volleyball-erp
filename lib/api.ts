// ================================================================
// lib/api.ts — API 層（Demo ↔ 正式系統 一鍵切換）
//
// Demo 模式：直接回傳 mock-data，不需要後端
// 正式模式：改成真實 API call，component 完全不需要動
//
// 切換方式：.env 設定 NEXT_PUBLIC_USE_MOCK=true/false
// ================================================================

import type { DashboardData, Session, Customer, Registration, UnpaidItem } from "@/types"
import { MOCK_DASHBOARD, MOCK_SESSIONS, MOCK_CUSTOMERS } from "@/lib/mock-data"

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"

// ── Dashboard ─────────────────────────────────────────────────────

export async function getDashboardData(date?: Date): Promise<DashboardData> {
  if (USE_MOCK) {
    // Demo：直接回傳假資料，加一點延遲讓它像真的 API
    await delay(200)
    return MOCK_DASHBOARD
  }
  // 正式：換成這行就好，component 不需要改
  const res = await fetch(`/api/dashboard?date=${(date ?? new Date()).toISOString()}`)
  return res.json()
}

// ── 場次 ──────────────────────────────────────────────────────────

export async function getSessions(params: {
  venueId?: string
  date?: Date
  status?: string
}): Promise<Session[]> {
  if (USE_MOCK) {
    await delay(150)
    let sessions = MOCK_SESSIONS
    if (params.venueId) sessions = sessions.filter(s => s.venueId === params.venueId)
    return sessions
  }
  const q = new URLSearchParams(params as Record<string, string>)
  const res = await fetch(`/api/sessions?${q}`)
  return res.json()
}

export async function getSessionById(id: string): Promise<Session | null> {
  if (USE_MOCK) {
    await delay(100)
    return MOCK_SESSIONS.find(s => s.id === id) ?? null
  }
  const res = await fetch(`/api/sessions/${id}`)
  return res.json()
}

// ── 客戶 ──────────────────────────────────────────────────────────

export async function getCustomers(params?: {
  search?: string
  skillLevel?: string
}): Promise<Customer[]> {
  if (USE_MOCK) {
    await delay(150)
    let customers = MOCK_CUSTOMERS
    if (params?.search) {
      const q = params.search.toLowerCase()
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
    }
    return customers
  }
  const q = new URLSearchParams(params as Record<string, string>)
  const res = await fetch(`/api/customers?${q}`)
  return res.json()
}

// ── 付款 ──────────────────────────────────────────────────────────

export async function recordPayment(registrationId: string, payload: {
  amount: number
  method: "cash" | "transfer" | "online"
  notes?: string
}): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await delay(300)
    console.log("[MOCK] 記錄付款:", registrationId, payload)
    return { success: true }
  }
  const res = await fetch(`/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registrationId, ...payload }),
  })
  return res.json()
}

// ── 商品流向 ──────────────────────────────────────────────────────

export async function recordProductTransaction(payload: {
  productId:  string
  venueId:    string
  type:       "sale" | "gift" | "adjustment"
  quantity:   number
  unitPrice?: number
  customerId?: string
  sessionId?: string
  notes?:     string
}): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await delay(300)
    console.log("[MOCK] 商品流向記錄:", payload)
    return { success: true }
  }
  const res = await fetch(`/api/products/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return res.json()
}

// ── 工具 ──────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
