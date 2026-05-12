// ============================================================
// data/store.ts — 階段 3 production 升級的可變狀態層
// ============================================================
// 此檔的職責：
//   1. 在 client 端維護「localStorage 持久化的變更」
//   2. 在 hydrate 時把這些變更套回 GENERATED 陣列（in-place mutate）
//   3. 提供 useSyncExternalStore 訂閱機制給 client component
//
// 設計理由：
//   - `data/api.ts` 既有 read 函式直接 `GENERATED.x.find/filter/...`，
//     我們不重寫這些函式（HANDOFF 凍結）。
//   - 改成「直接 mutate GENERATED 的陣列內容」（push / splice / 修改欄位），
//     既有 read 函式自然見到最新值。
//   - 為支援重整不掉資料，把變更**以 diff 形式**存到 localStorage，
//     hydrate 時 replay 回 GENERATED。
//
// 不存 read-only 集合：venues / seasons / timeslots / sessions / payments /
//   products / venueProducts / users。這些階段 3 不會被 mutate。
// ============================================================

import { useSyncExternalStore } from 'react'
import { GENERATED } from './generator'
import type {
  AuditLog, Customer, Registration, RegistrationStatus,
  SeasonRental, SeasonRentalStatus,
} from '@/types'


// ============================================================
// 1. GENERATED 的 mutable 視角
// ============================================================
// generator.ts 對 GENERATED 用了 `as const`，TS 看起來是 readonly。
// 但 `as const` 純粹是型別層，runtime 物件本身可變。
// 這裡 cast 出一個 mutable view，供 store 內部 push/splice 用。
// ============================================================

const MUTABLE = GENERATED as unknown as {
  registrations: Registration[]
  customers: Customer[]
  seasonRentals: SeasonRental[]
}


// ============================================================
// 2. 持久化的「差異」（diff）
// ============================================================

interface PersistedDiff {
  /** 新增的客戶（加臨打時建立的）*/
  customersAdded: Customer[]
  /** 新增的報名（加臨打時建立的，type='walk_in'）*/
  registrationsAdded: Registration[]
  /** 對既有報名的狀態 patch（請假時 'registered' → 'cancelled'）*/
  registrationsPatches: Record<string, { status?: RegistrationStatus }>
  /** 新增的季租單（館長端「新增」流程建立的，status='pending'）*/
  seasonRentalsAdded: SeasonRental[]
  /** 對既有季租單的欄位 patch（重發 token / 停用）*/
  seasonRentalsPatches: Record<string, {
    accessToken?: string
    accessTokenExpiresAt?: string
    status?: SeasonRentalStatus
    updatedAt?: string
  }>
  /** 累積的 audit logs */
  auditLogs: AuditLog[]
  /** 目前登入的 User.id（u1-u4），預設 u1 陳老闆 */
  currentUserId: string
}

function emptyDiff(): PersistedDiff {
  return {
    customersAdded: [],
    registrationsAdded: [],
    registrationsPatches: {},
    seasonRentalsAdded: [],
    seasonRentalsPatches: {},
    auditLogs: [],
    currentUserId: 'u1',
  }
}


// ============================================================
// 3. 內部狀態
// ============================================================

const STORAGE_KEY = 'volleyops-stage3prod-v1'

/** Server-side 永遠是空 diff（保證 SSR 結果穩定）*/
const PRISTINE_DIFF: PersistedDiff = emptyDiff()

/** 目前實際使用的 diff（client mount 後可能被 localStorage 蓋掉）*/
let diff: PersistedDiff = PRISTINE_DIFF

/** 是否已對 GENERATED 套用過 diff（避免 hydrate 重複套）*/
let hydrated = false

/** 訂閱者清單 */
const listeners = new Set<() => void>()

/** 用單調遞增的版本號給 useSyncExternalStore 當 snapshot key */
let version = 0


// ============================================================
// 4. Persistence helpers
// ============================================================

function persist(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diff))
  } catch {
    // localStorage 失敗（隱私模式 / 配額滿）silently ignore — demo 仍可用
  }
}

function applyDiffToGenerated(d: PersistedDiff): void {
  // 4a. 新增客戶：push 進 MUTABLE.customers（避免 id 衝突，先 filter）
  const existingCustomerIds = new Set(MUTABLE.customers.map(c => c.id))
  for (const c of d.customersAdded) {
    if (!existingCustomerIds.has(c.id)) {
      MUTABLE.customers.push(c)
      existingCustomerIds.add(c.id)
    }
  }

  // 4b. 新增報名
  const existingRegIds = new Set(MUTABLE.registrations.map(r => r.id))
  for (const r of d.registrationsAdded) {
    if (!existingRegIds.has(r.id)) {
      MUTABLE.registrations.push(r)
      existingRegIds.add(r.id)
    }
  }

  // 4c. Patch 既有報名（請假狀態）
  for (const [regId, patch] of Object.entries(d.registrationsPatches)) {
    const r = MUTABLE.registrations.find(x => x.id === regId)
    if (r && patch.status !== undefined) {
      r.status = patch.status
    }
  }

  // 4d. 新增季租單
  const existingRentalIds = new Set(MUTABLE.seasonRentals.map(r => r.id))
  for (const r of d.seasonRentalsAdded) {
    if (!existingRentalIds.has(r.id)) {
      MUTABLE.seasonRentals.push(r)
      existingRentalIds.add(r.id)
    }
  }

  // 4e. Patch 既有季租單（token regen / deactivate）
  for (const [rentalId, patch] of Object.entries(d.seasonRentalsPatches)) {
    const r = MUTABLE.seasonRentals.find(x => x.id === rentalId)
    if (!r) continue
    if (patch.accessToken !== undefined) r.accessToken = patch.accessToken
    if (patch.accessTokenExpiresAt !== undefined) r.accessTokenExpiresAt = patch.accessTokenExpiresAt
    if (patch.status !== undefined) r.status = patch.status
    if (patch.updatedAt !== undefined) r.updatedAt = patch.updatedAt
  }
}

function notify(): void {
  version++
  for (const l of listeners) l()
}


// ============================================================
// 5. Public：hydrate（client 端開機呼叫一次）
// ============================================================

/**
 * 從 localStorage 讀回 diff 並 apply 到 GENERATED。
 * 安全：可重複呼叫，只會 hydrate 一次。
 */
export function hydrateStore(): void {
  if (typeof window === 'undefined' || hydrated) return
  hydrated = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      notify()
      return
    }
    const parsed = JSON.parse(raw) as Partial<PersistedDiff>
    diff = {
      customersAdded:        parsed.customersAdded        ?? [],
      registrationsAdded:    parsed.registrationsAdded    ?? [],
      registrationsPatches:  parsed.registrationsPatches  ?? {},
      seasonRentalsAdded:    parsed.seasonRentalsAdded    ?? [],
      seasonRentalsPatches:  parsed.seasonRentalsPatches  ?? {},
      auditLogs:             parsed.auditLogs             ?? [],
      currentUserId:         parsed.currentUserId         ?? 'u1',
    }
    applyDiffToGenerated(diff)
    notify()
  } catch {
    diff = emptyDiff()
    notify()
  }
}

/** 把 diff 完全清空並重整一次 — 用於 demo reset 按鈕 */
export function resetStore(): void {
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
    // 完整清空靠 reload — 因 GENERATED 已被 in-place mutate，無法乾淨 rollback
    window.location.reload()
  }
}


// ============================================================
// 6. Public：訂閱（給 useSyncExternalStore 用）
// ============================================================

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getStoreVersion(): number {
  return version
}

export function getServerStoreVersion(): number {
  return 0
}

/**
 * 訂閱 store 變更 — 任何呼叫此 hook 的 component 會在
 * mutation 發生時自動 re-render。
 *
 * 用法：在每個有 mutation 互動的頁面頂部呼叫一次：
 *   export default function MyPage() {
 *     useStoreSync()
 *     ...
 *   }
 */
export function useStoreSync(): number {
  return useSyncExternalStore(subscribeStore, getStoreVersion, getServerStoreVersion)
}


// ============================================================
// 7. Public：mutation primitives
// ============================================================
// 注意：這些是 low-level — 業務邏輯（例如「請假時要不要也通知工讀生」）
// 在 api.ts「七」section 的高階函式中組合呼叫。
// ============================================================

export function patchRegistrationStatus(regId: string, status: RegistrationStatus): void {
  const r = MUTABLE.registrations.find(x => x.id === regId)
  if (r) r.status = status
  diff.registrationsPatches[regId] = { ...diff.registrationsPatches[regId], status }
  persist()
  notify()
}

export function addCustomer(customer: Customer): void {
  MUTABLE.customers.push(customer)
  diff.customersAdded.push(customer)
  persist()
  notify()
}

export function addRegistration(reg: Registration): void {
  MUTABLE.registrations.push(reg)
  diff.registrationsAdded.push(reg)
  persist()
  notify()
}

export function patchSeasonRental(
  rentalId: string,
  patch: { accessToken?: string; accessTokenExpiresAt?: string; status?: SeasonRentalStatus; updatedAt?: string },
): void {
  const r = MUTABLE.seasonRentals.find(x => x.id === rentalId)
  if (r) {
    if (patch.accessToken !== undefined) r.accessToken = patch.accessToken
    if (patch.accessTokenExpiresAt !== undefined) r.accessTokenExpiresAt = patch.accessTokenExpiresAt
    if (patch.status !== undefined) r.status = patch.status
    if (patch.updatedAt !== undefined) r.updatedAt = patch.updatedAt
  }
  diff.seasonRentalsPatches[rentalId] = { ...diff.seasonRentalsPatches[rentalId], ...patch }
  persist()
  notify()
}

export function addSeasonRental(rental: SeasonRental): void {
  MUTABLE.seasonRentals.push(rental)
  diff.seasonRentalsAdded.push(rental)
  persist()
  notify()
}

export function appendAuditLog(log: AuditLog): void {
  diff.auditLogs = [log, ...diff.auditLogs]  // 最新在前
  persist()
  notify()
}

export function setCurrentUserId(userId: string): void {
  diff.currentUserId = userId
  persist()
  notify()
}


// ============================================================
// 8. Public：read accessors（供 api.ts「七」section 用）
// ============================================================

export function getAuditLogs(): AuditLog[] {
  return diff.auditLogs
}

export function getCurrentUserId(): string {
  return diff.currentUserId
}
