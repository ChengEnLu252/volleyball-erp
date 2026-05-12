// ============================================================
// data/store.ts — 階段 1-5 統一可變狀態層
// ============================================================
// 此檔的職責：
//   1. 在 client 端維護「localStorage 持久化的變更」
//   2. 在 hydrate 時把這些變更套回 GENERATED 陣列（in-place mutate）
//   3. 提供 useSyncExternalStore 訂閱機制給 client component
//
// 設計理由：
//   - `data/api.ts` 既有 read 函式直接 `GENERATED.x.find/filter/...`，
//     我們不重寫這些函式 — 改成「直接 mutate GENERATED 的陣列內容」，
//     既有 read 函式自然見到最新值。
//   - 為支援重整不掉資料，把變更以 diff 形式存到 localStorage，
//     hydrate 時 replay 回 GENERATED。
//
// 歷史脈絡：
//   - 階段 3：建立此 store（patchRegistrationStatus / addCustomer ...）
//   - 階段 5：原本 sibling 在 `store-stage5.ts`，後合併進此檔
//             (參考 HANDOFF-stage5 凍結決策 #2 修訂)
//             - 新增 in-memory `TRANSFERS` / `BOX_AUDITS`
//             - PersistedDiff 加 stage 5 欄位
//             - localStorage 沿用 `volleyops-stage3prod-v1`，
//               若偵測到 legacy `volleyops-stage5-v1` 自動 merge 並清除
//   - 階段 7：hydrate 內加 'PRODUCT_TRANSFER' migration
//   - 階段 8：PersistedDiff 加 `evidenceMetadata`（憑證 meta；
//             blob 本體放 `data/evidence-store.ts` 的 IndexedDB）
//
// 不存的資料（read-only）：venues / seasons / timeslots / sessions /
//   payments / products / venueProducts / users。階段 1-5 都不 mutate 這些。
// ============================================================

import { useSyncExternalStore } from 'react'
import { GENERATED } from './generator'
import type {
  AuditAction, AuditLog, Customer, Registration, RegistrationStatus,
  SeasonRental, SeasonRentalStatus,
  PaymentMethod, ProductTransaction,
  // 階段 6：types 解凍後從這裡 import（取代 store-stage5 sibling 自定）
  ProductTransfer, ProductTransferStatus, BoxAuditRecord,
  // 階段 8：上傳憑證 meta
  UploadedEvidence,
} from '@/types'

// 階段 6：本檔 re-export 這幾個型別，讓 data/api.ts 的既有 import 路徑可以不動。
//         （未來 api.ts 也可以直接從 '@/types' import，效果等價。）
export type { ProductTransfer, ProductTransferStatus, BoxAuditRecord } from '@/types'
export { PRODUCT_TRANSFER_STATUS_LABEL } from '@/types'


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
  productTransactions: ProductTransaction[]  // 階段 5 加：誠實商店盤點 adjustment / 調貨 adjustment
}


// ============================================================
// 2. 階段 5 in-memory entity：ProductTransfer & BoxAudit
// ============================================================
// 型別定義已於階段 6 搬入 types/index.ts，這裡只保留 in-memory 陣列
// 與 add/patch primitives。持久化透過 PersistedDiff。
// ============================================================

/** in-memory 調貨單陣列（種子空，demo 期間累積建立） */
const TRANSFERS: ProductTransfer[] = []

export function getAllTransfers(): ProductTransfer[] {
  return TRANSFERS
}

/** in-memory 盤點記錄陣列（種子空） */
const BOX_AUDITS: BoxAuditRecord[] = []

export function getAllBoxAudits(): BoxAuditRecord[] {
  return BOX_AUDITS
}


// ============================================================
// 3. 持久化的「差異」（diff）
// ============================================================

interface PersistedDiff {
  // ── 階段 1-4 ────────────────────────────────────────
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

  // ── 階段 5（原 store-stage5）────────────────────────
  /** Registration 自助回報 4 欄位 patch（無人場次） */
  registrationSelfReportPatches: Record<string, {
    selfReportedPaid?: boolean
    selfPaymentMethod?: PaymentMethod | null
    selfPaymentEvidence?: string | null
    selfReportedAt?: string | null
  }>
  /** 新增的商品異動（誠實商店盤點 adjustment / 調貨 adjustment） */
  productTransactionsAdded: ProductTransaction[]
  /** 新增的跨館調貨單 */
  transfersAdded: ProductTransfer[]
  /** 對既有調貨單的狀態 patch */
  transfersPatches: Record<string, { status?: ProductTransferStatus; completedAt?: string | null }>
  /** 新增的投錢箱盤點記錄 */
  boxAuditsAdded: BoxAuditRecord[]

  // ── 階段 8：上傳憑證 meta ───────────────────────────
  /**
   * 上傳憑證的 metadata（blob 本體存 IndexedDB；meta 在這）。
   * 兩邊用 id 串。順序：最新在後（append-only）。
   */
  evidenceMetadata: UploadedEvidence[]
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
    registrationSelfReportPatches: {},
    productTransactionsAdded: [],
    transfersAdded: [],
    transfersPatches: {},
    boxAuditsAdded: [],
    evidenceMetadata: [],
  }
}


// ============================================================
// 4. 內部狀態
// ============================================================

const STORAGE_KEY = 'volleyops-stage3prod-v1'
/** 階段 5 過渡：若使用者本地有此 key 表示用過 sibling 版，hydrate 時 merge 入主 key */
const LEGACY_STAGE5_KEY = 'volleyops-stage5-v1'

const PRISTINE_DIFF: PersistedDiff = emptyDiff()
let diff: PersistedDiff = PRISTINE_DIFF
let hydrated = false
const listeners = new Set<() => void>()
let version = 0


// ============================================================
// 5. Persistence helpers
// ============================================================

function persist(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diff))
  } catch {
    /* silently ignore */
  }
}

function applyDiffToGenerated(d: PersistedDiff): void {
  // ── 5a. 新增客戶 ────────────────────────────────
  const existingCustomerIds = new Set(MUTABLE.customers.map(c => c.id))
  for (const c of d.customersAdded) {
    if (!existingCustomerIds.has(c.id)) {
      MUTABLE.customers.push(c)
      existingCustomerIds.add(c.id)
    }
  }

  // ── 5b. 新增報名 ────────────────────────────────
  const existingRegIds = new Set(MUTABLE.registrations.map(r => r.id))
  for (const r of d.registrationsAdded) {
    if (!existingRegIds.has(r.id)) {
      MUTABLE.registrations.push(r)
      existingRegIds.add(r.id)
    }
  }

  // ── 5c. Patch 報名狀態 ──────────────────────────
  for (const [regId, patch] of Object.entries(d.registrationsPatches)) {
    const r = MUTABLE.registrations.find(x => x.id === regId)
    if (r && patch.status !== undefined) {
      r.status = patch.status
    }
  }

  // ── 5d. 新增季租單 ──────────────────────────────
  const existingRentalIds = new Set(MUTABLE.seasonRentals.map(r => r.id))
  for (const r of d.seasonRentalsAdded) {
    if (!existingRentalIds.has(r.id)) {
      MUTABLE.seasonRentals.push(r)
      existingRentalIds.add(r.id)
    }
  }

  // ── 5e. Patch 季租單 ────────────────────────────
  for (const [rentalId, patch] of Object.entries(d.seasonRentalsPatches)) {
    const r = MUTABLE.seasonRentals.find(x => x.id === rentalId)
    if (!r) continue
    if (patch.accessToken !== undefined) r.accessToken = patch.accessToken
    if (patch.accessTokenExpiresAt !== undefined) r.accessTokenExpiresAt = patch.accessTokenExpiresAt
    if (patch.status !== undefined) r.status = patch.status
    if (patch.updatedAt !== undefined) r.updatedAt = patch.updatedAt
  }

  // ── 5f. (階段 5) Registration self-report patches ──
  for (const [regId, patch] of Object.entries(d.registrationSelfReportPatches)) {
    const r = MUTABLE.registrations.find(x => x.id === regId)
    if (!r) continue
    if (patch.selfReportedPaid    !== undefined) r.selfReportedPaid    = patch.selfReportedPaid
    if (patch.selfPaymentMethod   !== undefined) r.selfPaymentMethod   = patch.selfPaymentMethod
    if (patch.selfPaymentEvidence !== undefined) r.selfPaymentEvidence = patch.selfPaymentEvidence
    if (patch.selfReportedAt      !== undefined) r.selfReportedAt      = patch.selfReportedAt
  }

  // ── 5g. (階段 5) 新增 ProductTransaction ────────
  const existingTxIds = new Set(MUTABLE.productTransactions.map(t => t.id))
  for (const tx of d.productTransactionsAdded) {
    if (!existingTxIds.has(tx.id)) {
      MUTABLE.productTransactions.push(tx)
      existingTxIds.add(tx.id)
    }
  }

  // ── 5h. (階段 5) ProductTransfer (in-memory) ────
  const existingTransferIds = new Set(TRANSFERS.map(t => t.id))
  for (const tr of d.transfersAdded) {
    if (!existingTransferIds.has(tr.id)) {
      TRANSFERS.push(tr)
      existingTransferIds.add(tr.id)
    }
  }
  for (const [trId, patch] of Object.entries(d.transfersPatches)) {
    const t = TRANSFERS.find(x => x.id === trId)
    if (!t) continue
    if (patch.status      !== undefined) t.status      = patch.status
    if (patch.completedAt !== undefined) t.completedAt = patch.completedAt
  }

  // ── 5i. (階段 5) BoxAudits (in-memory) ──────────
  const existingAuditIds = new Set(BOX_AUDITS.map(a => a.id))
  for (const a of d.boxAuditsAdded) {
    if (!existingAuditIds.has(a.id)) {
      BOX_AUDITS.push(a)
      existingAuditIds.add(a.id)
    }
  }
}

function notify(): void {
  version++
  for (const l of listeners) l()
}


// ============================================================
// 6. Public：hydrate（client 端開機呼叫一次）
// ============================================================

/**
 * 階段 7 migration：舊 `'PRODUCT_TRANSFER'` audit log 拆為 4 個新 action。
 *
 * 階段 6 用單一 `'PRODUCT_TRANSFER'` action + `newValues.step` 區分 4 個 phase；
 * 階段 7 把 union 拆開，讓 audit filter 可單獨篩選每個 phase。
 *
 * 此 migration 從 `newValues.step` 推斷對應的新 action：
 *   - 'created'   → 'PRODUCT_TRANSFER_CREATED'
 *   - 'shipped'   → 'PRODUCT_TRANSFER_SHIPPED'
 *   - 'received'  → 'PRODUCT_TRANSFER_RECEIVED'
 *   - 'cancelled' → 'PRODUCT_TRANSFER_CANCELLED'
 *   - 未知 / 缺失 → 'PRODUCT_TRANSFER_CREATED'（safest fallback；正常產出不會走到）
 *
 * 一次性，hydrate 內呼叫；若有任何升級發生則 persist 寫回。
 */
function migrateProductTransferAuditLogs(
  logs: AuditLog[],
): { logs: AuditLog[]; migrated: number } {
  let migrated = 0
  const mapped: AuditLog[] = logs.map(log => {
    // 舊 action 'PRODUCT_TRANSFER' 在階段 7 已不在 union 內，
    // 必須先 cast as string 才能對到歷史資料
    if ((log.action as unknown as string) !== 'PRODUCT_TRANSFER') return log
    const stepRaw =
      log.newValues && typeof (log.newValues as Record<string, unknown>).step === 'string'
        ? ((log.newValues as Record<string, unknown>).step as string)
        : null
    let nextAction: AuditAction
    switch (stepRaw) {
      case 'created':   nextAction = 'PRODUCT_TRANSFER_CREATED';   break
      case 'shipped':   nextAction = 'PRODUCT_TRANSFER_SHIPPED';   break
      case 'received':  nextAction = 'PRODUCT_TRANSFER_RECEIVED';  break
      case 'cancelled': nextAction = 'PRODUCT_TRANSFER_CANCELLED'; break
      default:          nextAction = 'PRODUCT_TRANSFER_CREATED';   break
    }
    migrated++
    return { ...log, action: nextAction }
  })
  return { logs: mapped, migrated }
}

/**
 * 從 localStorage 讀回 diff 並 apply 到 GENERATED。
 * 安全：可重複呼叫，只會 hydrate 一次。
 *
 * Legacy migration：若存在舊 `volleyops-stage5-v1` key，會 merge 進主 key
 *   並清除舊 key（一次性，下次重整就不再執行）。
 *
 * 階段 7 migration：歷史 `'PRODUCT_TRANSFER'` audit log 自動升級為 4 個新 action。
 */
export function hydrateStore(): void {
  if (typeof window === 'undefined' || hydrated) return
  hydrated = true
  try {
    const mainRaw      = window.localStorage.getItem(STORAGE_KEY)
    const legacyRaw    = window.localStorage.getItem(LEGACY_STAGE5_KEY)
    const mainParsed   = mainRaw   ? JSON.parse(mainRaw)   as Partial<PersistedDiff> : null
    const legacyParsed = legacyRaw ? JSON.parse(legacyRaw) as Partial<PersistedDiff> : null

    if (!mainParsed && !legacyParsed) {
      notify()
      return
    }

    diff = {
      // 階段 1-4 欄位：完全來自主 key
      customersAdded:        mainParsed?.customersAdded        ?? [],
      registrationsAdded:    mainParsed?.registrationsAdded    ?? [],
      registrationsPatches:  mainParsed?.registrationsPatches  ?? {},
      seasonRentalsAdded:    mainParsed?.seasonRentalsAdded    ?? [],
      seasonRentalsPatches:  mainParsed?.seasonRentalsPatches  ?? {},
      auditLogs:             mainParsed?.auditLogs             ?? [],
      currentUserId:         mainParsed?.currentUserId         ?? 'u1',
      // 階段 5 欄位：優先讀主 key、退回 legacy key
      registrationSelfReportPatches:
        mainParsed?.registrationSelfReportPatches
        ?? legacyParsed?.registrationSelfReportPatches
        ?? {},
      productTransactionsAdded:
        mainParsed?.productTransactionsAdded
        ?? legacyParsed?.productTransactionsAdded
        ?? [],
      transfersAdded:
        mainParsed?.transfersAdded
        ?? legacyParsed?.transfersAdded
        ?? [],
      transfersPatches:
        mainParsed?.transfersPatches
        ?? legacyParsed?.transfersPatches
        ?? {},
      boxAuditsAdded:
        mainParsed?.boxAuditsAdded
        ?? legacyParsed?.boxAuditsAdded
        ?? [],
      // 階段 8：evidenceMetadata（純從主 key 讀；無 legacy 來源）
      evidenceMetadata: mainParsed?.evidenceMetadata ?? [],
    }
    applyDiffToGenerated(diff)

    // 階段 7 migration：升級舊 'PRODUCT_TRANSFER' audit log 為 4 個新 action
    const xferMig = migrateProductTransferAuditLogs(diff.auditLogs)
    const xferMigrated = xferMig.migrated > 0
    if (xferMigrated) {
      diff.auditLogs = xferMig.logs
    }

    // 若有 legacy 資料被 merge 進來、且主 key 沒有此欄位 → 寫回主 key + 清 legacy
    // 或階段 7 migration 有升級 → 寫回主 key
    const legacyMerged = legacyParsed && !mainParsed?.boxAuditsAdded
    if (legacyMerged || xferMigrated) {
      persist()
      if (legacyMerged) {
        try { window.localStorage.removeItem(LEGACY_STAGE5_KEY) } catch {}
      }
    }

    notify()
  } catch {
    diff = emptyDiff()
    notify()
  }
}

/** 把 diff 完全清空並重整 — 用於 demo reset 按鈕 */
export function resetStore(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_STAGE5_KEY)
    } catch {}
    window.location.reload()
  }
}


// ============================================================
// 7. Public：訂閱（給 useSyncExternalStore 用）
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
 *
 * 涵蓋階段 1-5 所有 mutation（合併前需呼叫兩個 hook，現已單一）。
 */
export function useStoreSync(): number {
  return useSyncExternalStore(subscribeStore, getStoreVersion, getServerStoreVersion)
}


// ============================================================
// 8. Public：mutation primitives — 階段 1-4
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
  diff.auditLogs = [log, ...diff.auditLogs]
  persist()
  notify()
}

export function setCurrentUserId(userId: string): void {
  diff.currentUserId = userId
  persist()
  notify()
}


// ============================================================
// 9. Public：mutation primitives — 階段 5
// ============================================================

/** 客戶自助回報已付款 — 寫 Registration 4 個自助欄位 */
export function patchRegistrationSelfReport(
  regId: string,
  fields: {
    selfReportedPaid?: boolean
    selfPaymentMethod?: PaymentMethod | null
    selfPaymentEvidence?: string | null
    selfReportedAt?: string | null
  },
): void {
  const r = MUTABLE.registrations.find(x => x.id === regId)
  if (r) {
    if (fields.selfReportedPaid    !== undefined) r.selfReportedPaid    = fields.selfReportedPaid
    if (fields.selfPaymentMethod   !== undefined) r.selfPaymentMethod   = fields.selfPaymentMethod
    if (fields.selfPaymentEvidence !== undefined) r.selfPaymentEvidence = fields.selfPaymentEvidence
    if (fields.selfReportedAt      !== undefined) r.selfReportedAt      = fields.selfReportedAt
  }
  diff.registrationSelfReportPatches[regId] = {
    ...diff.registrationSelfReportPatches[regId],
    ...fields,
  }
  persist()
  notify()
}

/** 新增一筆商品異動（誠實商店盤點 adjustment / 跨館調貨 adjustment） */
export function addProductTransaction(tx: ProductTransaction): void {
  MUTABLE.productTransactions.push(tx)
  diff.productTransactionsAdded.push(tx)
  persist()
  notify()
}

/** 新增一筆跨館調貨單 */
export function addProductTransfer(transfer: ProductTransfer): void {
  TRANSFERS.push(transfer)
  diff.transfersAdded.push(transfer)
  persist()
  notify()
}

/** 更新調貨單狀態（出貨 / 收件 / 完成 / 取消） */
export function patchProductTransfer(
  transferId: string,
  patch: { status?: ProductTransferStatus; completedAt?: string | null },
): void {
  const t = TRANSFERS.find(x => x.id === transferId)
  if (t) {
    if (patch.status      !== undefined) t.status      = patch.status
    if (patch.completedAt !== undefined) t.completedAt = patch.completedAt
  }
  diff.transfersPatches[transferId] = {
    ...diff.transfersPatches[transferId],
    ...patch,
  }
  persist()
  notify()
}

/** 新增一筆投錢箱盤點記錄 */
export function addBoxAudit(audit: BoxAuditRecord): void {
  BOX_AUDITS.push(audit)
  diff.boxAuditsAdded.push(audit)
  persist()
  notify()
}

// ── 階段 8：上傳憑證 meta ──────────────────────────────

/**
 * 新增一筆上傳憑證 meta。
 *
 * **只管 meta**：blob 本體請另外用 `data/evidence-store.ts`
 * 的 `putEvidence(id, blob)` 寫入 IndexedDB。
 *
 * 兩邊用 meta.id 串。建議呼叫順序：
 *   1. await putEvidence(id, blob)（先寫 blob，失敗 fast-fail）
 *   2. addEvidenceMeta(meta)（再寫 meta + persist + notify）
 *
 * 反向順序會有「meta 存在但 blob 不在」的不一致風險。
 */
export function addEvidenceMeta(meta: UploadedEvidence): void {
  diff.evidenceMetadata.push(meta)
  persist()
  notify()
}

/**
 * 標記憑證 meta 為「blob 已刪除」（保留 meta 用於 audit）。
 *
 * 不真的從 diff 移除 meta — 留著讓 audit log 仍可追蹤
 * 「曾經存在過這個檔案」。caller 仍需另外 call evidence-store
 * 的 `deleteEvidence(id)` 清 IndexedDB blob。
 */
export function markEvidenceBlobDeleted(id: string): void {
  const m = diff.evidenceMetadata.find(e => e.id === id)
  if (m) m.blobAvailable = false
  persist()
  notify()
}


// ============================================================
// 10. Public：read accessors（供 api.ts section 7 使用）
// ============================================================

export function getAuditLogs(): AuditLog[] {
  return diff.auditLogs
}

export function getCurrentUserId(): string {
  return diff.currentUserId
}

/**
 * 取得目前所有上傳憑證的 meta。
 *
 * 階段 8 新增；blob 本體請用 `data/evidence-store.ts` 的
 * `getEvidence(id)` / `getEvidenceObjectUrl(id)` 取。
 */
export function getEvidenceMetadata(): UploadedEvidence[] {
  return diff.evidenceMetadata
}
