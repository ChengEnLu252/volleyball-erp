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
//   階段 10 改：payments 變 mutable（退費鏈會 push negative Payment）。
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
  // 階段 10：Payment 首次變 mutable（退費鏈），RefundDecision 為終局決策
  Payment, RefundDecision,
  // 階段 12：addSession mutation
  Session,
} from '@/types'

// 階段 9：移除階段 6 留下的 type re-export。
// 當時為了讓 data/api.ts 可以從 './store' 拿型別，sibling 在這 re-export。
// 經 grep 確認 app/ components/ 無人從 '@/data/store' import 這幾個型別 —
// 全都 inline 從 '@/data/api' import；api.ts 階段 9 已改為直接從 '@/types' import。
// 此 re-export 自此無人引用，移除以避免「同一個型別有兩個 import 路徑」的混亂。


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
  payments: Payment[]                         // 階段 10 加：退費鏈會 push negative Payment
  sessions: Session[]                          // 階段 12 加：新增場次 mutation 用
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
  /**
   * 對既有報名的狀態 patch（請假時 'registered' → 'cancelled'）。
   * 階段 9 加 `updatedAt?`：mutation 端 bump 時序，用於樂觀鎖。
   * 階段 10 加 `refundDecision?`：issueRefund / waiveRefund mutation 寫此通道。
   */
  registrationsPatches: Record<string, {
    status?: RegistrationStatus
    updatedAt?: string
    refundDecision?: RefundDecision | null
  }>
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
  /** 目前登入的 User.id（u1-u4），預設 u1 王家凱 */
  currentUserId: string

  // ── 階段 5（原 store-stage5）────────────────────────
  /**
   * Registration 自助回報 4 欄位 patch（無人場次）。
   * 階段 9 加 `updatedAt?`：自助回報也算「對 Registration 的修改」，
   * mutation 端會 bump 時序以支援樂觀鎖。
   */
  registrationSelfReportPatches: Record<string, {
    selfReportedPaid?: boolean
    selfPaymentMethod?: PaymentMethod | null
    selfPaymentEvidence?: string | null
    selfReportedAt?: string | null
    updatedAt?: string
  }>
  /** 新增的商品異動（誠實商店盤點 adjustment / 調貨 adjustment） */
  productTransactionsAdded: ProductTransaction[]
  /** 新增的跨館調貨單 */
  transfersAdded: ProductTransfer[]
  /**
   * 對既有調貨單的狀態 patch。
   * 階段 9 加 `updatedAt?`：出貨 / 收貨 / 取消 都會 bump 時序。
   */
  transfersPatches: Record<string, {
    status?: ProductTransferStatus
    completedAt?: string | null
    updatedAt?: string
  }>
  /** 新增的投錢箱盤點記錄 */
  boxAuditsAdded: BoxAuditRecord[]

  // ── 階段 8：上傳憑證 meta ───────────────────────────
  /**
   * 上傳憑證的 metadata（blob 本體存 IndexedDB；meta 在這）。
   * 兩邊用 id 串。順序：最新在後（append-only）。
   */
  evidenceMetadata: UploadedEvidence[]

  // ── 階段 10：退費鏈 — Payment 首次成為 mutable ────
  /**
   * 新增的 Payment（階段 10 起，退費 issueRefund 會 push amount<0 的 Payment）。
   *
   * 種子 Payment 全部在 GENERATED.payments；這邊只放階段 10+ 經 mutation 建立的。
   * hydrate 時把這些 push 進 MUTABLE.payments（同一個陣列引用）。
   *
   * 雖然 union 包正負額（未來補繳付款也走此通道），目前 demo 只有 negative refund。
   */
  paymentsAdded: Payment[]

  // ── 階段 12 新增：館長/老闆新增場次（範本批量 + 單場手動共用此通道）
  /**
   * 新增的 Session（階段 12 起，由 ERP 後台「新增場次」功能建立的）。
   *
   * 種子 Session 全部在 GENERATED.sessions；這邊只放階段 12+ 經 mutation 建立的。
   * hydrate 時把這些 push 進 MUTABLE.sessions（同一個陣列引用）。
   */
  sessionsAdded: Session[]
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
    paymentsAdded: [],
    sessionsAdded: [],
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
  // 階段 9：對 legacy diff（沒 updatedAt 的 Registration）做 fallback
  // 階段 10：對 legacy diff（沒 refundDecision 的 Registration）補 null
  const existingRegIds = new Set(MUTABLE.registrations.map(r => r.id))
  for (const r of d.registrationsAdded) {
    if (!existingRegIds.has(r.id)) {
      const enriched: Registration = {
        ...r,
        updatedAt: r.updatedAt ?? r.registeredAt,
        refundDecision: r.refundDecision ?? null,
      }
      MUTABLE.registrations.push(enriched)
      existingRegIds.add(r.id)
    }
  }

  // ── 5c. Patch 報名狀態 ──────────────────────────
  // 階段 10：refundDecision 也走此通道（issueRefund / waiveRefund 寫 patches）
  for (const [regId, patch] of Object.entries(d.registrationsPatches)) {
    const r = MUTABLE.registrations.find(x => x.id === regId)
    if (!r) continue
    if (patch.status         !== undefined) r.status         = patch.status
    if (patch.updatedAt      !== undefined) r.updatedAt      = patch.updatedAt
    if (patch.refundDecision !== undefined) r.refundDecision = patch.refundDecision
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

  // ── 5b'. 階段 9：對既有 generator 種子 Registration 補 updatedAt ──
  // 防範性：若 type 升級後跑舊 generator 仍可工作（通常 generator 已補；
  // 但 hot-reload 期間或測試環境可能例外）
  // 階段 10：refundDecision 同等防範性補 null
  for (const r of MUTABLE.registrations) {
    if (!r.updatedAt) {
      r.updatedAt = r.registeredAt
    }
    if (r.refundDecision === undefined) {
      r.refundDecision = null
    }
  }

  // ── 5f. (階段 5) Registration self-report patches ──
  for (const [regId, patch] of Object.entries(d.registrationSelfReportPatches)) {
    const r = MUTABLE.registrations.find(x => x.id === regId)
    if (!r) continue
    if (patch.selfReportedPaid    !== undefined) r.selfReportedPaid    = patch.selfReportedPaid
    if (patch.selfPaymentMethod   !== undefined) r.selfPaymentMethod   = patch.selfPaymentMethod
    if (patch.selfPaymentEvidence !== undefined) r.selfPaymentEvidence = patch.selfPaymentEvidence
    if (patch.selfReportedAt      !== undefined) r.selfReportedAt      = patch.selfReportedAt
    if (patch.updatedAt           !== undefined) r.updatedAt           = patch.updatedAt
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
  // 階段 9：對 legacy diff（沒 updatedAt 的 ProductTransfer）做 fallback
  const existingTransferIds = new Set(TRANSFERS.map(t => t.id))
  for (const tr of d.transfersAdded) {
    if (!existingTransferIds.has(tr.id)) {
      const enriched: ProductTransfer = {
        ...tr,
        updatedAt: tr.updatedAt ?? tr.requestedAt,
      }
      TRANSFERS.push(enriched)
      existingTransferIds.add(tr.id)
    }
  }
  for (const [trId, patch] of Object.entries(d.transfersPatches)) {
    const t = TRANSFERS.find(x => x.id === trId)
    if (!t) continue
    if (patch.status      !== undefined) t.status      = patch.status
    if (patch.completedAt !== undefined) t.completedAt = patch.completedAt
    if (patch.updatedAt   !== undefined) t.updatedAt   = patch.updatedAt
  }

  // ── 5i. (階段 5) BoxAudits (in-memory) ──────────
  // 階段 9：對 legacy diff（沒 updatedAt）做 fallback
  const existingAuditIds = new Set(BOX_AUDITS.map(a => a.id))
  for (const a of d.boxAuditsAdded) {
    if (!existingAuditIds.has(a.id)) {
      const enriched: BoxAuditRecord = {
        ...a,
        updatedAt: a.updatedAt ?? a.auditedAt,
      }
      BOX_AUDITS.push(enriched)
      existingAuditIds.add(a.id)
    }
  }

  // ── 5j. (階段 10) 新增 Payment（退費鏈：amount<0、status='refunded'）──
  // 種子 Payment 在 GENERATED.payments；階段 10+ mutation 建立的在 d.paymentsAdded。
  // hydrate 把後者 push 進 MUTABLE.payments（同一物件，read 函式自動看到）。
  const existingPaymentIds = new Set(MUTABLE.payments.map(p => p.id))
  for (const p of d.paymentsAdded) {
    if (!existingPaymentIds.has(p.id)) {
      MUTABLE.payments.push(p)
      existingPaymentIds.add(p.id)
    }
  }

  // ── 5k. (階段 12) 新增 Session（範本批量 + 單場手動的新場次）──
  // 種子 Session 在 GENERATED.sessions；階段 12+ mutation 建立的在 d.sessionsAdded。
  const existingSessionIds = new Set(MUTABLE.sessions.map(s => s.id))
  for (const s of d.sessionsAdded) {
    if (!existingSessionIds.has(s.id)) {
      MUTABLE.sessions.push(s)
      existingSessionIds.add(s.id)
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
      // 階段 10：paymentsAdded（純從主 key 讀；無 legacy 來源；舊版本沒此欄位 → []）
      paymentsAdded: mainParsed?.paymentsAdded ?? [],
      // 階段 12：sessionsAdded（純從主 key 讀；無 legacy 來源；舊版本沒此欄位 → []）
      sessionsAdded: mainParsed?.sessionsAdded ?? [],
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

/**
 * Patch 報名狀態（請假 / 取消請假）。
 *
 * 階段 9：可選 `updatedAt` 參數 — 同時 bump entity.updatedAt 與
 * diff.patches.updatedAt，供樂觀鎖比對使用。不傳則只動 status，
 * updatedAt 保持原值（向後相容）。
 */
export function patchRegistrationStatus(
  regId: string,
  status: RegistrationStatus,
  updatedAt?: string,
): void {
  const r = MUTABLE.registrations.find(x => x.id === regId)
  if (r) {
    r.status = status
    if (updatedAt !== undefined) r.updatedAt = updatedAt
  }
  diff.registrationsPatches[regId] = {
    ...diff.registrationsPatches[regId],
    status,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  }
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

/**
 * 客戶自助回報已付款 — 寫 Registration 4 個自助欄位。
 *
 * 階段 9：fields 可帶 `updatedAt` — 同時 bump entity.updatedAt 與
 * diff.patches.updatedAt，支援樂觀鎖。不傳則 entity.updatedAt 保持原值。
 */
export function patchRegistrationSelfReport(
  regId: string,
  fields: {
    selfReportedPaid?: boolean
    selfPaymentMethod?: PaymentMethod | null
    selfPaymentEvidence?: string | null
    selfReportedAt?: string | null
    updatedAt?: string
  },
): void {
  const r = MUTABLE.registrations.find(x => x.id === regId)
  if (r) {
    if (fields.selfReportedPaid    !== undefined) r.selfReportedPaid    = fields.selfReportedPaid
    if (fields.selfPaymentMethod   !== undefined) r.selfPaymentMethod   = fields.selfPaymentMethod
    if (fields.selfPaymentEvidence !== undefined) r.selfPaymentEvidence = fields.selfPaymentEvidence
    if (fields.selfReportedAt      !== undefined) r.selfReportedAt      = fields.selfReportedAt
    if (fields.updatedAt           !== undefined) r.updatedAt           = fields.updatedAt
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

/**
 * 更新調貨單狀態（出貨 / 收件 / 完成 / 取消）。
 *
 * 階段 9：patch 可帶 `updatedAt` — 同時 bump entity.updatedAt
 * 與 diff，用於樂觀鎖。
 */
export function patchProductTransfer(
  transferId: string,
  patch: {
    status?: ProductTransferStatus
    completedAt?: string | null
    updatedAt?: string
  },
): void {
  const t = TRANSFERS.find(x => x.id === transferId)
  if (t) {
    if (patch.status      !== undefined) t.status      = patch.status
    if (patch.completedAt !== undefined) t.completedAt = patch.completedAt
    if (patch.updatedAt   !== undefined) t.updatedAt   = patch.updatedAt
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
// 9.5 Public：mutation primitives — 階段 10（退費鏈）
// ============================================================

/**
 * 新增一筆 Payment（階段 10：通常用於退費，amount < 0、status = 'refunded'）。
 *
 * 與 add* 系列一致：push 進 MUTABLE.payments + 寫入 diff.paymentsAdded + persist + notify。
 * 設計上 union 允許正負額；但目前 demo 範圍只用 refund（負額）。未來若把舊「補繳」
 * 流程改走 mutation（而非 generator 種子），可重用本 primitive。
 */
export function addPayment(payment: Payment): void {
  MUTABLE.payments.push(payment)
  diff.paymentsAdded.push(payment)
  persist()
  notify()
}

/**
 * 階段 12 新增：新增一筆 Session（場次）。
 *
 * 用於館長/老闆透過 ERP 後台「新增場次」UI 建立的場次。
 * 範本批量 / 單場手動 兩種建立方式共用此 primitive；
 * 差別只在「上層 mutation 一次叫幾次」。
 *
 * 跟其他 add* 一致：push 進 MUTABLE.sessions + 寫入 diff.sessionsAdded + persist + notify。
 *
 * ⚠️ 此 primitive 不做業務檢核（重複日期 / 衝突偵測等），呼叫端 api.ts 負責。
 */
export function addSession(session: Session): void {
  MUTABLE.sessions.push(session)
  diff.sessionsAdded.push(session)
  persist()
  notify()
}

/**
 * 標記 Registration 的退費決策（'refunded' / 'waived'，或 reset 為 null）。
 *
 * 與其他 patch primitive 一致：bump entity + 寫 patches diff + 可選 updatedAt。
 * 通常與 addPayment 配對使用（issueRefund mutation），或單獨使用（waiveRefund mutation）。
 */
export function patchRegistrationRefund(
  regId: string,
  decision: RefundDecision | null,
  updatedAt?: string,
): void {
  const r = MUTABLE.registrations.find(x => x.id === regId)
  if (r) {
    r.refundDecision = decision
    if (updatedAt !== undefined) r.updatedAt = updatedAt
  }
  diff.registrationsPatches[regId] = {
    ...diff.registrationsPatches[regId],
    refundDecision: decision,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  }
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
