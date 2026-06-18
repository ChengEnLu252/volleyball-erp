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
  // 階段 16：館長週目標 + 通知
  WeeklyGoal, WeeklyGoalStatus, AppNotification,
  // 階段 17：線上商城（訂單 + 商品庫存）
  Order, OrderStatus, ShopProduct, ShopVariant,
  // 階段 18：月記帳表（館長輸入 + 老闆對帳）
  LedgerDay,
  // 階段 19：員工薪資（工讀生時薪表 + 管理職薪資）
  PartTimerPayrollSheet, PartTimerRow, ManagerSalaryRecord,
  ReportSubmission,
  // 階段 20 M2：採購/修繕簽核、零用金台帳、比賽企劃
  ProcurementRequest, PettyCashEntry, CompetitionPlan,
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
  weeklyGoals: WeeklyGoal[]                    // 階段 16 加：館長週目標
  notifications: AppNotification[]             // 階段 16 加：通知收件匣
  shopProducts: ShopProduct[]                  // 階段 17 加：線上商城商品（onlineStock 會 mutate）
  orders: Order[]                              // 階段 17 加：商城訂單
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

/**
 * 階段 18：in-memory 月記帳表陣列（種子空，由館長輸入累積）。
 * 唯一鍵 `${venueId}:${date}`；upsert 語意（同鍵覆蓋）。
 * 持久化透過 PersistedDiff.ledgerDaysUpserts。
 */
// 階段 20 M2-1 示範種子：球魔方(v1) 本月三筆問題記帳，分別觸發
//   負帳未填($500) / 營收漏填($100) / 匯款金額不符($100)。
// （v1 為「營收驟降」故事館，記帳品質不良與其營運危機呼應。）
function seedLedger(
  venueId: string, day: number,
  partial: Partial<LedgerDay>,
): LedgerDay {
  const ym = payrollMonth()
  const date = `${ym}-${String(day).padStart(2, '0')}`
  return {
    venueId, date,
    slots: {},
    merch: 0, snacks: 0, drinks: 0, ac: 0, other: 0,
    seasonFee: 0, privatePrepay: 0, acFee: 0, refund: 0,
    acDegrees: 0,
    bookingNote: '', refundNote: '', merchNote: '',
    reported: false,
    updatedBy: 'u2', updatedAt: new Date().toISOString(),
    ...partial,
  }
}

const LEDGER_DAYS: LedgerDay[] = [
  // 02 日：退款 -2,500 造成當日負帳，卻未填退款明細 → 負帳未填 $500
  seedLedger('v1', 2, { refund: -2500, reported: true }),
  // 03 日：館長按了「回報完畢」卻整日 0 元 → 營收漏填 $100
  seedLedger('v1', 3, { reported: true }),
  // 04 日：只記了一個時段 3,000 + 商品 500（遠少於系統當月場地費）
  //        → 本月場地費記帳與系統不符 → 匯款金額不符 $100
  seedLedger('v1', 4, { slots: { '19~20': 3000 }, merch: 500, reported: true }),
]

export function getAllLedgerDays(): LedgerDay[] {
  return LEDGER_DAYS
}

/** 階段 18：組鍵 helper（store 內部 + api 共用語意） */
function ledgerKey(venueId: string, date: string): string {
  return `${venueId}:${date}`
}


/**
 * 階段 19：工讀生時薪表（每館每月一張）。
 * 唯一鍵 `${venueId}:${month}`；upsert 語意。
 * 有種子（規章圖 13 人掛林口 v2 當前月）；persist 透過 PersistedDiff。
 */
function payrollMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

/** 階段 20 M2：N 天前的 ISO 時戳（種子用；負數 = 過去） */
function nowIso(daysOffset = 0): string {
  return new Date(Date.now() + daysOffset * 86400000).toISOString()
}

function seedPtRow(
  id: string, name: string, level: PartTimerRow['level'], rate: number, hours: number,
): PartTimerRow {
  return { id, name, level, hourlyRate: rate, normalHours: hours, bonus: 0, penalty: 0, note: '' }
}

const PART_TIMER_SHEETS: PartTimerPayrollSheet[] = [{
  venueId: 'v2',
  month: payrollMonth(),
  rows: [
    seedPtRow('ptseed-1',  'Leo',      'captain_x2',     210, 26),
    seedPtRow('ptseed-2',  '念恩',     'captain_x2',     210, 35),
    seedPtRow('ptseed-3',  '徐敬',     'helper',         190, 6),
    seedPtRow('ptseed-4',  '阿超',     'helper',         190, 1),
    seedPtRow('ptseed-5',  '偉翔',     'senior_helper',  200, 1.5),
    seedPtRow('ptseed-6',  '文',       'captain_helper', 195, 8),
    seedPtRow('ptseed-7',  '威皓',     'helper',         190, 14),
    seedPtRow('ptseed-8',  '品豪',     'captain_senior', 220, 16),
    seedPtRow('ptseed-9',  '小菜',     'helper',         190, 2),
    seedPtRow('ptseed-10', '星',       'senior_helper',  195, 0),
    seedPtRow('ptseed-11', '甄',       'helper',         190, 9),
    seedPtRow('ptseed-12', '馨柔',     'helper',         190, 1.5),
    seedPtRow('ptseed-13', '(新)小馬', 'helper',         190, 1),
  ],
  revenueOverride: 284780,
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}, {
  // 階段 21 M4 demo：球魔方 2.0（五股, v1）工讀生時薪示範
  venueId: 'v1',
  month: payrollMonth(),
  rows: [
    seedPtRow('ptseed-v1-1', '阿哲',   'captain_x2',     210, 30),
    seedPtRow('ptseed-v1-2', '小昕',   'captain_senior', 220, 18),
    seedPtRow('ptseed-v1-3', '冠廷',   'senior_helper',  200, 12),
    seedPtRow('ptseed-v1-4', '宥任',   'helper',         190, 9),
    seedPtRow('ptseed-v1-5', '雅婷',   'helper',         190, 5),
    seedPtRow('ptseed-v1-6', '(新)柏宇','helper',        190, 2),
  ],
  revenueOverride: 198400,
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}]

export function getAllPartTimerSheets(): PartTimerPayrollSheet[] {
  return PART_TIMER_SHEETS
}

function partTimerKey(venueId: string, month: string): string {
  return `${venueId}:${month}`
}

/**
 * 階段 19：管理職薪資（每人每月一筆）。
 * 唯一鍵 = record.id；有種子（林口館主示範一筆）。
 */
const MANAGER_SALARIES: ManagerSalaryRecord[] = [{
  id: `v2:${payrollMonth()}:linkou-manager`,
  venueId: 'v2',
  month: payrollMonth(),
  personName: '林口Ace 館主',
  baseSalary: 35000,
  designPay: 0,
  bonuses: [{ id: 'mb-seed-1', label: '中秋獎金', amount: 0 }],
  includeOffPeakBonus: true,
  insuranceSelf: 0,
  leaveDays: 2,
  deductions: [],
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}, {
  // 階段 21 M4 demo：球魔方 2.0（五股, v1）— 兼美編、本月營收較弱（呼應 v1 營收驟降故事）
  id: `v1:${payrollMonth()}:wugu-manager`,
  venueId: 'v1',
  month: payrollMonth(),
  personName: '五股 球魔方 館主',
  baseSalary: 38000,
  designPay: 3000,
  bonuses: [{ id: 'mb-v1-1', label: '中秋獎金', amount: 6000 }],
  includeOffPeakBonus: true,
  insuranceSelf: 1357,
  leaveDays: 1,
  deductions: [],
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}, {
  // 飛翼（v3）— 高營收館、無美編
  id: `v3:${payrollMonth()}:feiyi-manager`,
  venueId: 'v3',
  month: payrollMonth(),
  personName: '飛翼 館主',
  baseSalary: 40000,
  designPay: 0,
  bonuses: [],
  includeOffPeakBonus: true,
  insuranceSelf: 1500,
  leaveDays: 0,
  deductions: [],
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}, {
  // Hibi 日日（中壢, v4）
  id: `v4:${payrollMonth()}:zhongli-manager`,
  venueId: 'v4',
  month: payrollMonth(),
  personName: '中壢 Hibi 館主',
  baseSalary: 36000,
  designPay: 2500,
  bonuses: [],
  includeOffPeakBonus: true,
  insuranceSelf: 1287,
  leaveDays: 0,
  deductions: [],
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}, {
  // play one（八德, v5）— 含請假扣薪 + 一筆其他扣款示範
  id: `v5:${payrollMonth()}:bade-manager`,
  venueId: 'v5',
  month: payrollMonth(),
  personName: '八德 play one 館主',
  baseSalary: 35000,
  designPay: 0,
  bonuses: [],
  includeOffPeakBonus: true,
  insuranceSelf: 1287,
  leaveDays: 3,
  deductions: [{ id: 'md-v5-1', label: '制服 / 雜支代扣', amount: 500 }],
  updatedBy: 'u1',
  updatedAt: '2026-01-01T00:00:00Z',
}]

export function getAllManagerSalaries(): ManagerSalaryRecord[] {
  return MANAGER_SALARIES
}

/**
 * 階段 20：報表繳交紀錄（每館每月每報表一筆）。
 * 唯一鍵 = `${venueId}:${month}:${type}`；有種子（示範本月各館繳交狀況：含準時、遲交、未繳）。
 */
function reportKey(venueId: string, month: string, type: ReportSubmission['type']): string {
  return `${venueId}:${month}:${type}`
}

function seedReport(venueId: string, type: ReportSubmission['type'], submittedDay: number | null): ReportSubmission {
  const month = payrollMonth()
  return { id: reportKey(venueId, month, type), venueId, month, type, submittedDay }
}

// 示範資料：林口準時、八德排班遲交、五股零用金未繳、內壢庫存遲交、新竹存款回報未繳…
const REPORT_SUBMISSIONS: ReportSubmission[] = [
  // v2 林口：全準時
  seedReport('v2', 'parttime_wage', 2), seedReport('v2', 'petty_cash', 3), seedReport('v2', 'manager_salary', 4),
  seedReport('v2', 'product_stock', 24), seedReport('v2', 'wage_receipt', 9), seedReport('v2', 'schedule', 23), seedReport('v2', 'cash_deposit', 1),
  // v5 八德：排班遲交、其餘準時
  seedReport('v5', 'parttime_wage', 3), seedReport('v5', 'petty_cash', 2), seedReport('v5', 'manager_salary', 5),
  seedReport('v5', 'product_stock', 25), seedReport('v5', 'wage_receipt', 8), seedReport('v5', 'schedule', 28), seedReport('v5', 'cash_deposit', 1),
  // v1 五股：零用金未繳、薪資明細遲交
  seedReport('v1', 'parttime_wage', 6), seedReport('v1', 'petty_cash', null), seedReport('v1', 'manager_salary', 4),
  seedReport('v1', 'product_stock', 23), seedReport('v1', 'wage_receipt', 10), seedReport('v1', 'schedule', 25), seedReport('v1', 'cash_deposit', 1),
  // v4 內壢：庫存表遲交
  seedReport('v4', 'parttime_wage', 2), seedReport('v4', 'petty_cash', 3), seedReport('v4', 'manager_salary', 5),
  seedReport('v4', 'product_stock', 28), seedReport('v4', 'wage_receipt', 9), seedReport('v4', 'schedule', 24), seedReport('v4', 'cash_deposit', 1),
  // v3 飛翼：薪資領取表未繳
  seedReport('v3', 'parttime_wage', 3), seedReport('v3', 'petty_cash', 3), seedReport('v3', 'manager_salary', 4),
  seedReport('v3', 'product_stock', 22), seedReport('v3', 'wage_receipt', null), seedReport('v3', 'schedule', 25), seedReport('v3', 'cash_deposit', 1),
  // v6 新竹：存款回報未繳、館主薪資表遲交
  seedReport('v6', 'parttime_wage', 3), seedReport('v6', 'petty_cash', 2), seedReport('v6', 'manager_salary', 8),
  seedReport('v6', 'product_stock', 24), seedReport('v6', 'wage_receipt', 9), seedReport('v6', 'schedule', 23), seedReport('v6', 'cash_deposit', null),
]

export function getAllReportSubmissions(): ReportSubmission[] {
  return REPORT_SUBMISSIONS
}


// ── 階段 20 M2-2：採購 / 修繕簽核 ───────────────────────────
// 唯一鍵 = record.id；upsert 語意。種子涵蓋各簽核狀態與三個金額級距。
const PROCUREMENT_REQUESTS: ProcurementRequest[] = [
  {
    id: 'pr-v2-001', venueId: 'v2', kind: 'purchase', title: '排球網×2 + 計分板',
    amount: 1800, status: 'approved', requestedBy: 'u2', requestedAt: nowIso(-12),
    approvedBy: 'u2', approvedAt: nowIso(-12), completionEvidenceRef: null, completedAt: null,
    note: '館長自核（< $2,000）',
  },
  {
    id: 'pr-v4-001', venueId: 'v4', kind: 'repair', title: '地板局部翻修',
    amount: 4200, status: 'pending', requestedBy: 'u3', requestedAt: nowIso(-3),
    approvedBy: null, approvedAt: null, completionEvidenceRef: null, completedAt: null,
    note: '$2,000–5,000 需老闆核准',
  },
  {
    id: 'pr-v1-001', venueId: 'v1', kind: 'repair', title: '中央空調壓縮機更換',
    amount: 38000, status: 'approved', requestedBy: 'u2', requestedAt: nowIso(-20),
    approvedBy: 'u1', approvedAt: nowIso(-18), completionEvidenceRef: null, completedAt: null,
    note: '> $5,000：老闆已核准，待完工存證（完工照）',
  },
  {
    id: 'pr-v5-001', venueId: 'v5', kind: 'purchase', title: '飲水機 + 製冰機',
    amount: 9600, status: 'completed', requestedBy: 'u4', requestedAt: nowIso(-40),
    approvedBy: 'u1', approvedAt: nowIso(-38), completionEvidenceRef: 'EVID-2024-0917',
    completedAt: nowIso(-30), note: '> $5,000：已核准並完工存證',
  },
]
export function getAllProcurementRequests(): ProcurementRequest[] {
  return PROCUREMENT_REQUESTS
}

// ── 階段 20 M2-3：零用金台帳（年度 6 萬上限）────────────────
// 唯一鍵 = record.id；新增語意（不覆蓋）。球魔方(v1) 故意超出 6 萬上限以示範扣年終。
function seedPetty(
  venueId: string, id: string, monthOffset: number, day: number,
  category: PettyCashEntry['category'], label: string, amount: number,
): PettyCashEntry {
  const d = new Date()
  const dt = new Date(d.getFullYear(), d.getMonth() - monthOffset, day)
  return {
    id, venueId,
    date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    category, label, amount, enteredBy: venueId === 'v1' ? 'u2' : 'u3',
    enteredAt: new Date().toISOString(), note: '',
  }
}
const PETTY_CASH_ENTRIES: PettyCashEntry[] = [
  // v1 球魔方：本年度累計約 6.5 萬 → 超過 6 萬上限 → 扣年終 5,000
  seedPetty('v1', 'pc-v1-01', 5, 8,  '維護耗材', '球網繩、標誌桿', 8200),
  seedPetty('v1', 'pc-v1-02', 4, 12, '清潔用品', '地板清潔劑、拖把', 6400),
  seedPetty('v1', 'pc-v1-03', 3, 5,  '茶水',     '飲水機濾心 + 茶包', 5300),
  seedPetty('v1', 'pc-v1-04', 2, 18, '維護耗材', '冷氣濾網更換', 12800),
  seedPetty('v1', 'pc-v1-05', 1, 9,  '雜支',     '臨時搬運工資', 9900),
  seedPetty('v1', 'pc-v1-06', 1, 22, '文具',     '報名表單、印章', 3700),
  seedPetty('v1', 'pc-v1-07', 0, 3,  '維護耗材', '燈管更換一批', 11200),
  seedPetty('v1', 'pc-v1-08', 0, 6,  '交通',     '調貨油資', 7600),
  // v2 林口：年度約 2.3 萬，遠低於上限
  seedPetty('v2', 'pc-v2-01', 3, 10, '清潔用品', '清潔用品補充', 4200),
  seedPetty('v2', 'pc-v2-02', 2, 14, '茶水',     '茶水間補給', 3100),
  seedPetty('v2', 'pc-v2-03', 1, 7,  '維護耗材', '小五金', 5600),
  seedPetty('v2', 'pc-v2-04', 0, 4,  '文具',     '辦公文具', 2400),
  // v4 內壢：年度約 1.8 萬
  seedPetty('v4', 'pc-v4-01', 2, 9,  '清潔用品', '清潔用品', 3800),
  seedPetty('v4', 'pc-v4-02', 1, 16, '茶水',     '飲水耗材', 2900),
  seedPetty('v4', 'pc-v4-03', 0, 5,  '雜支',     '雜項補給', 4100),
]
export function getAllPettyCashEntries(): PettyCashEntry[] {
  return PETTY_CASH_ENTRIES
}

// ── 階段 20 M2-4：比賽企劃追蹤 ──────────────────────────────
// 唯一鍵 = record.id；新增語意。種子設計：v2/v5 達標(≥3)，v1 只 2 場(未達→扣3000)，
// v4(內壢)+v6(新竹) 合計 3 場（< 合計門檻 4 → 兩館共扣）。
function seedComp(
  venueId: string, id: string, monthOffset: number, title: string,
  status: CompetitionPlan['status'],
): CompetitionPlan {
  const d = new Date()
  const dt = new Date(d.getFullYear(), d.getMonth() - monthOffset, 15)
  return {
    id, venueId, title,
    date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-15`,
    status, note: '', createdBy: venueId === 'v1' ? 'u2' : 'u3',
    createdAt: new Date().toISOString(),
  }
}
const COMPETITION_PLANS: CompetitionPlan[] = [
  // v2 林口：3 場已舉辦 → 達標
  seedComp('v2', 'cp-v2-01', 4, '春季友誼賽',     'done'),
  seedComp('v2', 'cp-v2-02', 2, '館際對抗賽',     'done'),
  seedComp('v2', 'cp-v2-03', 0, '夏季排球聯誼',   'done'),
  // v5 play one：3 場（2 done + 1 規劃中，仍計入企劃數）→ 達標
  seedComp('v5', 'cp-v5-01', 3, '社區排球日',     'done'),
  seedComp('v5', 'cp-v5-02', 1, '親子排球體驗',   'done'),
  seedComp('v5', 'cp-v5-03', 0, '中秋盃',         'planned'),
  // v1 球魔方：只有 2 場 → 未達 3 → 扣年終 3,000
  seedComp('v1', 'cp-v1-01', 3, '開幕紀念賽',     'done'),
  seedComp('v1', 'cp-v1-02', 0, '會員盃',         'planned'),
  // v4 內壢 + v6 新竹 合計門檻 4：目前 v4×2 + v6×1 = 3 < 4 → 兩館共扣
  seedComp('v4', 'cp-v4-01', 2, '內壢友誼賽',     'done'),
  seedComp('v4', 'cp-v4-02', 0, '新莊交流賽',     'planned'),
  seedComp('v6', 'cp-v6-01', 1, '新竹city盃',     'done'),
]
export function getAllCompetitionPlans(): CompetitionPlan[] {
  return COMPETITION_PLANS
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
  /**
   * 階段 14 加：是否已通過登入驗證。
   * 預設 false → 首次進入會顯示 LoginCard。
   * 登入後 true 並 persist；按「登出」改回 false。
   *
   * 注意：currentUserId 永遠有值（預設 u1），不能用「currentUserId 是否存在」判斷登入狀態。
   */
  isAuthenticated: boolean

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

  // ── 階段 21 M3（Q1 應收）：既有場次的費用 patch ──────────
  /**
   * 對既有 Session 的費用欄位 patch（館長在場次頁編輯）。
   * key = sessionId，value = 要覆蓋的 courtFee / acFee / acEnabled。
   * 種子場次在 GENERATED.sessions、階段 12+ 新增的在 sessionsAdded，
   * 兩者皆可被此 patch 覆蓋；套用時同步重算該場 expectedRevenue。
   */
  sessionFeePatches: Record<string, {
    courtFee?: number
    acFee?: number
    acEnabled?: boolean
    updatedAt?: string
  }>

  // ── 階段 16：館長週目標 + 通知 ───────────────────────
  /** 新增的週目標（老闆指派 / 館長自加）；種子在 GENERATED.weeklyGoals */
  weeklyGoalsAdded: WeeklyGoal[]
  /** 對既有週目標的欄位 patch（提交 / 確認 / 退回） */
  weeklyGoalsPatches: Record<string, {
    status?: WeeklyGoalStatus
    evidenceId?: string | null
    submittedBy?: string | null
    submittedAt?: string | null
    confirmedBy?: string | null
    confirmedAt?: string | null
    returnReason?: string | null
    updatedAt?: string
  }>
  /** 新增的通知；種子在 GENERATED.notifications */
  notificationsAdded: AppNotification[]
  /** 對既有通知的 patch（目前只有 isRead） */
  notificationsPatches: Record<string, { isRead?: boolean }>

  // ── 階段 17：線上商城（訂單 + 商品庫存） ─────────────
  /** 新增的訂單（線上自助 / 後台代客）；種子在 GENERATED.orders */
  ordersAdded: Order[]
  /** 對既有訂單的狀態 / 時間戳 patch（付款 / 完成 / 取消） */
  ordersPatches: Record<string, {
    status?: OrderStatus
    paidAt?: string | null
    fulfilledAt?: string | null
    cancelledAt?: string | null
    cancelReason?: string | null
    updatedAt?: string
  }>
  /**
   * 對商城商品的 patch（庫存 onlineStock / 上下架 isListed）。
   * 商品本體 seed 在 GENERATED.shopProducts；這裡只記 runtime 變動。
   */
  shopProductsPatches: Record<string, {
    onlineStock?: number
    isListed?: boolean
    unitPrice?: number
    /** 規格庫存矩陣（有規格商品調庫存 / 下單扣補時整批覆蓋） */
    variants?: ShopVariant[]
    updatedAt?: string
  }>

  // ── 階段 18：月記帳表（館長輸入）─────────────────────
  /**
   * 月記帳表 upsert（館長輸入的每日記帳）。
   * key = `${venueId}:${date}`，value = 整筆 LedgerDay（覆蓋語意）。
   * 無 generator 種子；全部來自 runtime mutation。
   */
  ledgerDaysUpserts: Record<string, LedgerDay>

  // ── 階段 19：員工薪資 ───────────────────────────────
  /** 工讀生時薪表 upsert：key = `${venueId}:${month}`，value = 整張表 */
  partTimerSheetsUpserts: Record<string, PartTimerPayrollSheet>
  /** 管理職薪資 upsert：key = record.id，value = 整筆 */
  managerSalariesUpserts: Record<string, ManagerSalaryRecord>

  // ── 階段 20：報表繳交追蹤 ───────────────────────────
  /** 報表繳交 upsert：key = `${venueId}:${month}:${type}`，value = 整筆 */
  reportSubmissionsUpserts: Record<string, ReportSubmission>

  // ── 階段 20 M2：採購簽核 / 零用金 / 比賽企劃（皆 key = record.id）──
  /** 採購/修繕簽核 upsert：key = record.id */
  procurementUpserts: Record<string, ProcurementRequest>
  /** 零用金台帳 upsert：key = record.id */
  pettyCashUpserts: Record<string, PettyCashEntry>
  /** 比賽企劃 upsert：key = record.id */
  competitionUpserts: Record<string, CompetitionPlan>
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
    isAuthenticated: false,
    registrationSelfReportPatches: {},
    productTransactionsAdded: [],
    transfersAdded: [],
    transfersPatches: {},
    boxAuditsAdded: [],
    evidenceMetadata: [],
    paymentsAdded: [],
    sessionsAdded: [],
    sessionFeePatches: {},
    weeklyGoalsAdded: [],
    weeklyGoalsPatches: {},
    notificationsAdded: [],
    notificationsPatches: {},
    ordersAdded: [],
    ordersPatches: {},
    shopProductsPatches: {},
    ledgerDaysUpserts: {},
    partTimerSheetsUpserts: {},
    managerSalariesUpserts: {},
    reportSubmissionsUpserts: {},
    procurementUpserts: {},
    pettyCashUpserts: {},
    competitionUpserts: {},
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

  // ── 5k-2. (階段 21 M3) 既有場次費用 patch + 重算 expectedRevenue ──
  // 套用後重算「應收（只算臨打）」= (walk_in + season_substitute 人數)
  //   × (courtFee + (acEnabled ? acFee : 0))，讓所有讀 s.expectedRevenue 的
  //   下游（venue 摘要 / AI 洞察 / 對帳）即時反映館長的費用編輯。
  for (const [sid, patch] of Object.entries(d.sessionFeePatches)) {
    const s = MUTABLE.sessions.find(x => x.id === sid)
    if (!s) continue
    if (patch.courtFee   !== undefined) s.courtFee   = patch.courtFee
    if (patch.acFee      !== undefined) s.acFee      = patch.acFee
    if (patch.acEnabled  !== undefined) s.acEnabled  = patch.acEnabled
    if (patch.updatedAt  !== undefined) s.updatedAt  = patch.updatedAt
    const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
    const chargeable = MUTABLE.registrations.filter(
      r => r.sessionId === s.id && r.status !== 'cancelled'
        && (r.type === 'walk_in' || r.type === 'season_substitute'),
    ).length
    s.expectedRevenue = fee * chargeable
  }

  // ── 5h. 階段 16：週目標 — 新增 + patch ─────────────
  // 種子在 GENERATED.weeklyGoals；runtime 建立的在 d.weeklyGoalsAdded。
  const existingGoalIds = new Set(MUTABLE.weeklyGoals.map(g => g.id))
  for (const g of d.weeklyGoalsAdded) {
    if (!existingGoalIds.has(g.id)) {
      MUTABLE.weeklyGoals.push(g)
      existingGoalIds.add(g.id)
    }
  }
  for (const [id, patch] of Object.entries(d.weeklyGoalsPatches)) {
    const g = MUTABLE.weeklyGoals.find(x => x.id === id)
    if (!g) continue
    if (patch.status       !== undefined) g.status       = patch.status
    if (patch.evidenceId   !== undefined) g.evidenceId   = patch.evidenceId
    if (patch.submittedBy  !== undefined) g.submittedBy  = patch.submittedBy
    if (patch.submittedAt  !== undefined) g.submittedAt  = patch.submittedAt
    if (patch.confirmedBy  !== undefined) g.confirmedBy  = patch.confirmedBy
    if (patch.confirmedAt  !== undefined) g.confirmedAt  = patch.confirmedAt
    if (patch.returnReason !== undefined) g.returnReason = patch.returnReason
    if (patch.updatedAt    !== undefined) g.updatedAt    = patch.updatedAt
  }

  // ── 5i. 階段 16：通知 — 新增 + patch（已讀） ────────
  const existingNotifIds = new Set(MUTABLE.notifications.map(n => n.id))
  for (const n of d.notificationsAdded) {
    if (!existingNotifIds.has(n.id)) {
      MUTABLE.notifications.push(n)
      existingNotifIds.add(n.id)
    }
  }
  for (const [id, patch] of Object.entries(d.notificationsPatches)) {
    const n = MUTABLE.notifications.find(x => x.id === id)
    if (!n) continue
    if (patch.isRead !== undefined) n.isRead = patch.isRead
  }

  // ── 5j. 階段 17：商城訂單 — 新增 + patch ────────────
  // 種子在 GENERATED.orders；runtime 建立的在 d.ordersAdded。
  const existingOrderIds = new Set(MUTABLE.orders.map(o => o.id))
  for (const o of d.ordersAdded) {
    if (!existingOrderIds.has(o.id)) {
      MUTABLE.orders.push(o)
      existingOrderIds.add(o.id)
    }
  }
  for (const [id, patch] of Object.entries(d.ordersPatches)) {
    const o = MUTABLE.orders.find(x => x.id === id)
    if (!o) continue
    if (patch.status       !== undefined) o.status       = patch.status
    if (patch.paidAt       !== undefined) o.paidAt       = patch.paidAt
    if (patch.fulfilledAt  !== undefined) o.fulfilledAt  = patch.fulfilledAt
    if (patch.cancelledAt  !== undefined) o.cancelledAt  = patch.cancelledAt
    if (patch.cancelReason !== undefined) o.cancelReason = patch.cancelReason
    if (patch.updatedAt    !== undefined) o.updatedAt    = patch.updatedAt
  }

  // ── 5k. 階段 17：商城商品庫存 — patch only（seed 在 GENERATED）──
  for (const [id, patch] of Object.entries(d.shopProductsPatches)) {
    const p = MUTABLE.shopProducts.find(x => x.id === id)
    if (!p) continue
    if (patch.onlineStock !== undefined) p.onlineStock = patch.onlineStock
    if (patch.isListed    !== undefined) p.isListed    = patch.isListed
    if (patch.unitPrice   !== undefined) p.unitPrice   = patch.unitPrice
    if (patch.variants    !== undefined) p.variants    = patch.variants
    if (patch.updatedAt   !== undefined) p.updatedAt   = patch.updatedAt
  }

  // ── 5l. 階段 18：月記帳表 — upsert into LEDGER_DAYS（無 generator 種子）──
  // diff.ledgerDaysUpserts 是 `${venueId}:${date}` → LedgerDay 的整筆覆蓋。
  // hydrate 時 replay：同鍵則覆蓋既有、否則 push。
  for (const day of Object.values(d.ledgerDaysUpserts)) {
    const idx = LEDGER_DAYS.findIndex(x => x.venueId === day.venueId && x.date === day.date)
    if (idx >= 0) LEDGER_DAYS[idx] = day
    else LEDGER_DAYS.push(day)
  }

  // ── 5m. 階段 19：員工薪資 — upsert into PART_TIMER_SHEETS / MANAGER_SALARIES ──
  for (const sheet of Object.values(d.partTimerSheetsUpserts)) {
    const idx = PART_TIMER_SHEETS.findIndex(x => x.venueId === sheet.venueId && x.month === sheet.month)
    if (idx >= 0) PART_TIMER_SHEETS[idx] = sheet
    else PART_TIMER_SHEETS.push(sheet)
  }
  for (const rec of Object.values(d.managerSalariesUpserts)) {
    const idx = MANAGER_SALARIES.findIndex(x => x.id === rec.id)
    if (idx >= 0) MANAGER_SALARIES[idx] = rec
    else MANAGER_SALARIES.push(rec)
  }

  // ── 5n. 階段 20：報表繳交追蹤 — upsert into REPORT_SUBMISSIONS ──
  for (const r of Object.values(d.reportSubmissionsUpserts)) {
    const idx = REPORT_SUBMISSIONS.findIndex(x => x.id === r.id)
    if (idx >= 0) REPORT_SUBMISSIONS[idx] = r
    else REPORT_SUBMISSIONS.push(r)
  }

  // ── 5o. 階段 20 M2：採購簽核 / 零用金 / 比賽企劃（皆以 record.id upsert）──
  for (const r of Object.values(d.procurementUpserts)) {
    const idx = PROCUREMENT_REQUESTS.findIndex(x => x.id === r.id)
    if (idx >= 0) PROCUREMENT_REQUESTS[idx] = r
    else PROCUREMENT_REQUESTS.push(r)
  }
  for (const r of Object.values(d.pettyCashUpserts)) {
    const idx = PETTY_CASH_ENTRIES.findIndex(x => x.id === r.id)
    if (idx >= 0) PETTY_CASH_ENTRIES[idx] = r
    else PETTY_CASH_ENTRIES.push(r)
  }
  for (const r of Object.values(d.competitionUpserts)) {
    const idx = COMPETITION_PLANS.findIndex(x => x.id === r.id)
    if (idx >= 0) COMPETITION_PLANS[idx] = r
    else COMPETITION_PLANS.push(r)
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
      isAuthenticated:       mainParsed?.isAuthenticated        ?? false,
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
      // 階段 21 M3：既有場次費用 patch（純從主 key 讀；舊版本沒此欄位 → {}）
      sessionFeePatches: mainParsed?.sessionFeePatches ?? {},
      // 階段 16：週目標 + 通知（純從主 key 讀；舊版本沒此欄位 → 預設空）
      weeklyGoalsAdded:    mainParsed?.weeklyGoalsAdded    ?? [],
      weeklyGoalsPatches:  mainParsed?.weeklyGoalsPatches  ?? {},
      notificationsAdded:  mainParsed?.notificationsAdded  ?? [],
      notificationsPatches: mainParsed?.notificationsPatches ?? {},
      // 階段 17：商城訂單 + 商品庫存（純從主 key 讀；舊版本沒此欄位 → 預設空）
      ordersAdded:         mainParsed?.ordersAdded         ?? [],
      ordersPatches:       mainParsed?.ordersPatches       ?? {},
      shopProductsPatches: mainParsed?.shopProductsPatches ?? {},
      // 階段 18：月記帳表（純從主 key 讀；舊版本沒此欄位 → 預設空）
      ledgerDaysUpserts:   mainParsed?.ledgerDaysUpserts   ?? {},
      // 階段 19：員工薪資（純從主 key 讀；舊版本沒此欄位 → 預設空）
      partTimerSheetsUpserts: mainParsed?.partTimerSheetsUpserts ?? {},
      managerSalariesUpserts: mainParsed?.managerSalariesUpserts ?? {},
      reportSubmissionsUpserts: mainParsed?.reportSubmissionsUpserts ?? {},
      // 階段 20 M2（純從主 key 讀；舊版本沒此欄位 → 預設空）
      procurementUpserts: mainParsed?.procurementUpserts ?? {},
      pettyCashUpserts:   mainParsed?.pettyCashUpserts   ?? {},
      competitionUpserts: mainParsed?.competitionUpserts ?? {},
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

/** 階段 14：標記登入狀態（true=已通過驗證，false=登出回登入頁） */
export function setIsAuthenticated(value: boolean): void {
  diff.isAuthenticated = value
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
 * 階段 21 M3（Q1 應收）：編輯既有場次的費用欄位（場地費 / 冷氣費 / 是否開冷氣）。
 *
 * 同時 mutate MUTABLE（讓本頁立即看到）+ 重算該場 expectedRevenue
 * （只算臨打 = walk_in + season_substitute 人數 × (courtFee + acEnabled?acFee:0)）
 * + 寫 diff（持久化）。種子場次與階段 12+ 新增場次皆可編輯。
 */
export function patchSessionFees(
  sessionId: string,
  patch: { courtFee?: number; acFee?: number; acEnabled?: boolean },
): void {
  const updatedAt = nowIso()
  const s = MUTABLE.sessions.find(x => x.id === sessionId)
  if (s) {
    if (patch.courtFee  !== undefined) s.courtFee  = patch.courtFee
    if (patch.acFee     !== undefined) s.acFee     = patch.acFee
    if (patch.acEnabled !== undefined) s.acEnabled = patch.acEnabled
    s.updatedAt = updatedAt
    const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
    const chargeable = MUTABLE.registrations.filter(
      r => r.sessionId === s.id && r.status !== 'cancelled'
        && (r.type === 'walk_in' || r.type === 'season_substitute'),
    ).length
    s.expectedRevenue = fee * chargeable
  }
  const prev = diff.sessionFeePatches[sessionId] ?? {}
  diff.sessionFeePatches[sessionId] = { ...prev, ...patch, updatedAt }
  persist()
  notify()
}

// ============================================================
// 9.7 Public：mutation primitives — 階段 16（館長週目標 + 通知）
// ============================================================

/** 新增一筆週目標（老闆指派 / 館長自加）。 */
export function addWeeklyGoal(goal: WeeklyGoal): void {
  MUTABLE.weeklyGoals.push(goal)
  diff.weeklyGoalsAdded.push(goal)
  persist()
  notify()
}

/**
 * Patch 既有週目標（提交 / 確認 / 退回都走這）。
 * 同時 mutate MUTABLE（讓既有 read 立刻見到）+ 寫 diff（持久化）。
 */
export function patchWeeklyGoal(
  id: string,
  patch: {
    status?: WeeklyGoalStatus
    evidenceId?: string | null
    submittedBy?: string | null
    submittedAt?: string | null
    confirmedBy?: string | null
    confirmedAt?: string | null
    returnReason?: string | null
    updatedAt?: string
  },
): void {
  const g = MUTABLE.weeklyGoals.find(x => x.id === id)
  if (g) {
    if (patch.status       !== undefined) g.status       = patch.status
    if (patch.evidenceId   !== undefined) g.evidenceId   = patch.evidenceId
    if (patch.submittedBy  !== undefined) g.submittedBy  = patch.submittedBy
    if (patch.submittedAt  !== undefined) g.submittedAt  = patch.submittedAt
    if (patch.confirmedBy  !== undefined) g.confirmedBy  = patch.confirmedBy
    if (patch.confirmedAt  !== undefined) g.confirmedAt  = patch.confirmedAt
    if (patch.returnReason !== undefined) g.returnReason = patch.returnReason
    if (patch.updatedAt    !== undefined) g.updatedAt    = patch.updatedAt
  }
  const prev = diff.weeklyGoalsPatches[id] ?? {}
  diff.weeklyGoalsPatches[id] = { ...prev, ...patch }
  persist()
  notify()
}

/** 新增一筆通知。 */
export function addNotification(notif: AppNotification): void {
  MUTABLE.notifications.push(notif)
  diff.notificationsAdded.push(notif)
  persist()
  notify()
}

/** 標記某通知為已讀 / 未讀。 */
export function patchNotificationRead(id: string, isRead: boolean): void {
  const n = MUTABLE.notifications.find(x => x.id === id)
  if (n) n.isRead = isRead
  const prev = diff.notificationsPatches[id] ?? {}
  diff.notificationsPatches[id] = { ...prev, isRead }
  persist()
  notify()
}

/** 取得目前全部週目標（read primitive；api.ts 包裝過濾用）。 */
export function getAllWeeklyGoals(): WeeklyGoal[] {
  return MUTABLE.weeklyGoals
}

/** 取得目前全部通知（read primitive；api.ts 包裝過濾用）。 */
export function getAllNotifications(): AppNotification[] {
  return MUTABLE.notifications
}


// ============================================================
// 9.8 Public：mutation primitives — 階段 17（線上商城）
// ============================================================

/** 新增一筆商城訂單（線上自助 / 後台代客）。 */
export function addOrder(order: Order): void {
  MUTABLE.orders.push(order)
  diff.ordersAdded.push(order)
  persist()
  notify()
}

/** Patch 既有訂單（付款 / 完成 / 取消都走這）。 */
export function patchOrder(
  id: string,
  patch: {
    status?: OrderStatus
    paidAt?: string | null
    fulfilledAt?: string | null
    cancelledAt?: string | null
    cancelReason?: string | null
    updatedAt?: string
  },
): void {
  const o = MUTABLE.orders.find(x => x.id === id)
  if (o) {
    if (patch.status       !== undefined) o.status       = patch.status
    if (patch.paidAt       !== undefined) o.paidAt       = patch.paidAt
    if (patch.fulfilledAt  !== undefined) o.fulfilledAt  = patch.fulfilledAt
    if (patch.cancelledAt  !== undefined) o.cancelledAt  = patch.cancelledAt
    if (patch.cancelReason !== undefined) o.cancelReason = patch.cancelReason
    if (patch.updatedAt    !== undefined) o.updatedAt    = patch.updatedAt
  }
  const prev = diff.ordersPatches[id] ?? {}
  diff.ordersPatches[id] = { ...prev, ...patch }
  persist()
  notify()
}

/** 取得目前全部訂單（read primitive；api.ts 包裝過濾用）。 */
export function getAllOrders(): Order[] {
  return MUTABLE.orders
}

/** Patch 商城商品（庫存 onlineStock / 上下架 isListed / 單價）。 */
export function patchShopProduct(
  id: string,
  patch: {
    onlineStock?: number
    isListed?: boolean
    unitPrice?: number
    variants?: ShopVariant[]
    updatedAt?: string
  },
): void {
  const p = MUTABLE.shopProducts.find(x => x.id === id)
  if (p) {
    if (patch.onlineStock !== undefined) p.onlineStock = patch.onlineStock
    if (patch.isListed    !== undefined) p.isListed    = patch.isListed
    if (patch.unitPrice   !== undefined) p.unitPrice   = patch.unitPrice
    if (patch.variants    !== undefined) p.variants    = patch.variants
    if (patch.updatedAt   !== undefined) p.updatedAt   = patch.updatedAt
  }
  const prev = diff.shopProductsPatches[id] ?? {}
  diff.shopProductsPatches[id] = { ...prev, ...patch }
  persist()
  notify()
}

/** 取得目前全部商城商品（read primitive；api.ts 包裝過濾用）。 */
export function getAllShopProducts(): ShopProduct[] {
  return MUTABLE.shopProducts
}


// ============================================================
// 9.9 Public：mutation primitives — 階段 18（月記帳表）
// ============================================================

/**
 * 新增 / 覆蓋一天的月記帳表（館長輸入）。
 *
 * upsert 語意：以 `${venueId}:${date}` 為鍵。同鍵覆蓋既有、否則新增。
 * 同時 mutate in-memory LEDGER_DAYS（讓既有 read 立刻見到）+ 寫 diff（持久化）。
 */
export function upsertLedgerDay(day: LedgerDay): void {
  const idx = LEDGER_DAYS.findIndex(x => x.venueId === day.venueId && x.date === day.date)
  if (idx >= 0) LEDGER_DAYS[idx] = day
  else LEDGER_DAYS.push(day)
  diff.ledgerDaysUpserts[ledgerKey(day.venueId, day.date)] = day
  persist()
  notify()
}


/**
 * 階段 19：新增 / 覆蓋一張工讀生時薪表（每館每月一張）。
 * upsert 鍵 = `${venueId}:${month}`。
 */
export function upsertPartTimerSheet(sheet: PartTimerPayrollSheet): void {
  const idx = PART_TIMER_SHEETS.findIndex(x => x.venueId === sheet.venueId && x.month === sheet.month)
  if (idx >= 0) PART_TIMER_SHEETS[idx] = sheet
  else PART_TIMER_SHEETS.push(sheet)
  diff.partTimerSheetsUpserts[partTimerKey(sheet.venueId, sheet.month)] = sheet
  persist()
  notify()
}

/**
 * 階段 19：新增 / 覆蓋一筆管理職薪資。
 * upsert 鍵 = record.id。
 */
export function upsertManagerSalary(record: ManagerSalaryRecord): void {
  const idx = MANAGER_SALARIES.findIndex(x => x.id === record.id)
  if (idx >= 0) MANAGER_SALARIES[idx] = record
  else MANAGER_SALARIES.push(record)
  diff.managerSalariesUpserts[record.id] = record
  persist()
  notify()
}

/**
 * 階段 20：新增 / 覆蓋一筆報表繳交紀錄。
 * upsert 鍵 = `${venueId}:${month}:${type}`。
 */
export function upsertReportSubmission(record: ReportSubmission): void {
  const idx = REPORT_SUBMISSIONS.findIndex(x => x.id === record.id)
  if (idx >= 0) REPORT_SUBMISSIONS[idx] = record
  else REPORT_SUBMISSIONS.push(record)
  diff.reportSubmissionsUpserts[record.id] = record
  persist()
  notify()
}

/**
 * 階段 20 M2：新增 / 覆蓋一筆採購·修繕簽核（核准、退回、完工皆走此 upsert）。
 * upsert 鍵 = record.id。
 */
export function upsertProcurementRequest(record: ProcurementRequest): void {
  const idx = PROCUREMENT_REQUESTS.findIndex(x => x.id === record.id)
  if (idx >= 0) PROCUREMENT_REQUESTS[idx] = record
  else PROCUREMENT_REQUESTS.push(record)
  diff.procurementUpserts[record.id] = record
  persist()
  notify()
}

/**
 * 階段 20 M2：新增 / 覆蓋一筆零用金支出。
 * upsert 鍵 = record.id。
 */
export function upsertPettyCashEntry(record: PettyCashEntry): void {
  const idx = PETTY_CASH_ENTRIES.findIndex(x => x.id === record.id)
  if (idx >= 0) PETTY_CASH_ENTRIES[idx] = record
  else PETTY_CASH_ENTRIES.push(record)
  diff.pettyCashUpserts[record.id] = record
  persist()
  notify()
}

/**
 * 階段 20 M2：新增 / 覆蓋一筆比賽企劃（含改狀態為已舉辦 / 取消）。
 * upsert 鍵 = record.id。
 */
export function upsertCompetitionPlan(record: CompetitionPlan): void {
  const idx = COMPETITION_PLANS.findIndex(x => x.id === record.id)
  if (idx >= 0) COMPETITION_PLANS[idx] = record
  else COMPETITION_PLANS.push(record)
  diff.competitionUpserts[record.id] = record
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

/** 階段 14：目前是否通過登入驗證 */
export function getIsAuthenticated(): boolean {
  return diff.isAuthenticated
}

// ── Round 5：Auth.js session 使用者覆蓋層 ─────────────────────
// 由 SessionBridge 於登入後寫入（記憶體，不進 localStorage —— 每次開機
// 都從 session 重新灌）。data/api.ts 的「目前使用者」一律以此為準，
// 使「新註冊的 DB 使用者」（不在 generator 種子內）也能正確 scope。
export type SessionUserOverride = {
  id: string
  name: string
  globalRole: 'owner' | 'staff'
  role: 'owner' | 'manager' | 'staff' | 'none'
  visibleVenueIds: string[] | 'all'
}
let sessionUserOverride: SessionUserOverride | null = null

export function setSessionUserOverride(u: SessionUserOverride | null): void {
  sessionUserOverride = u
  notify()
}

export function getSessionUserOverride(): SessionUserOverride | null {
  return sessionUserOverride
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
