// ============================================================
// data/ledger-core.ts — 月記帳「純邏輯核心」（無 store / generator / prisma 相依）
// ------------------------------------------------------------
// P2.2d：把原 data/ledger.ts 內「設定常數 + 每日衍生計算 + 對帳結果型別」抽出，
//   讓 server（data/server/queries.ts，server-only）與 client 都能共用同一份定義，
//   不必拖進 store/generator（client-only / 假資料）。
//
// 對應對方 Excel「多爾森記帳表」的列。數字定義與 Excel 一致。
// ============================================================

import type { LedgerDay, LedgerSlotValue } from '@/types'

// ── 1. 設定常數 ─────────────────────────────────────────────

/** 冷氣單價（元 / 度）。Excel「一度 8 元」。 */
export const LEDGER_AC_RATE = 8

/** 時段分類（給冷門計算用） */
export type SlotKind = 'normal' | 'offpeak_weekday' | 'late'

export interface LedgerSlotDef {
  /** 內部 key（同時也是 LedgerDay.slots 的鍵） */
  key: string
  /** 顯示標籤 */
  label: string
  /** 是否屬「冷門 (9-19)」時段（僅平日計入） */
  offpeakWeekday: boolean
  /** 是否屬「冷門 (22-01)」時段 */
  late: boolean
}

/**
 * 時段定義（對應 Excel 列 8-9 ~ 24-01，共 17 個）。
 *
 * 冷門 (9-19)：09–10 ~ 18–19（平日才計入；Excel `WEEKDAY>5 → 0`）。
 * 冷門 (22-01)：22–23 / 23–24 / 24–01。
 */
export const LEDGER_SLOTS: ReadonlyArray<LedgerSlotDef> = [
  { key: '8-9',   label: '08–09', offpeakWeekday: false, late: false },
  { key: '9~10',  label: '09–10', offpeakWeekday: true,  late: false },
  { key: '10~11', label: '10–11', offpeakWeekday: true,  late: false },
  { key: '11~12', label: '11–12', offpeakWeekday: true,  late: false },
  { key: '12~13', label: '12–13', offpeakWeekday: true,  late: false },
  { key: '13~14', label: '13–14', offpeakWeekday: true,  late: false },
  { key: '14~15', label: '14–15', offpeakWeekday: true,  late: false },
  { key: '15~16', label: '15–16', offpeakWeekday: true,  late: false },
  { key: '16~17', label: '16–17', offpeakWeekday: true,  late: false },
  { key: '17~18', label: '17–18', offpeakWeekday: true,  late: false },
  { key: '18~19', label: '18–19', offpeakWeekday: true,  late: false },
  { key: '19~20', label: '19–20', offpeakWeekday: false, late: false },
  { key: '20~21', label: '20–21', offpeakWeekday: false, late: false },
  { key: '21~22', label: '21–22', offpeakWeekday: false, late: false },
  { key: '22-23', label: '22–23', offpeakWeekday: false, late: true  },
  { key: '23-24', label: '23–24', offpeakWeekday: false, late: true  },
  { key: '24-01', label: '24–01', offpeakWeekday: false, late: true  },
]

/** 銷售類別欄（Excel 商品 / 零食 / 飲料 / 冷氣 / 其他） */
export const LEDGER_CATEGORY_FIELDS = [
  { key: 'merch',  label: '商品' },
  { key: 'snacks', label: '零食' },
  { key: 'drinks', label: '飲料' },
  { key: 'ac',     label: '冷氣' },
  { key: 'other',  label: '其他' },
] as const

/** 收費 / 退款欄（Excel 季打收費 / 包場預付 / 冷氣費 / 退款） */
export const LEDGER_CHARGE_FIELDS = [
  { key: 'seasonFee',     label: '季打收費' },
  { key: 'privatePrepay', label: '包場預付' },
  { key: 'acFee',         label: '冷氣費' },
  { key: 'refund',        label: '退款' },
] as const


// ── 2. 小工具 ───────────────────────────────────────────────

/** 取時段數值（字串註記如「包場」「季租」視為 0，不計入場地費） */
export function numericSlot(v: LedgerSlotValue | undefined): number {
  return typeof v === 'number' ? v : 0
}

/** date 是否為平日（一~五） */
export function isWeekday(date: string): boolean {
  const d = new Date(date + 'T00:00:00').getDay() // 0=日 .. 6=六
  return d >= 1 && d <= 5
}

/** YYYY-MM-DD → 星期幾（0=日..6=六） */
export function weekdayOf(date: string): number {
  return new Date(date + 'T00:00:00').getDay()
}

/** 該月的所有日期（YYYY-MM-DD），照順序 */
export function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const out: string[] = []
  for (let d = 1; d <= last; d++) {
    out.push(`${ym}-${String(d).padStart(2, '0')}`)
  }
  return out
}


// ── 3. 每日衍生計算（與 Excel 定義一致）────────────────────────

export interface LedgerDayDerived {
  /** 場地費加總 = Σ 各時段數值 */
  courtTotal: number
  /** 銷售類別合計 = 商品+零食+飲料+冷氣+其他 */
  salesTotal: number
  /** 小計 = 場地費加總 + 銷售類別合計 */
  subtotal: number
  /** 總計 = 小計 + 季打收費 + 包場預付 + 冷氣費 + 退款 */
  total: number
  /** 冷門 (9-19)：平日 Σ 09–10~18–19；假日 0 */
  offpeakWeekday: number
  /** 冷門 (22-01)：Σ 22–23/23–24/24–01 */
  offpeakLate: number
  /** 冷門加總 */
  offpeakTotal: number
  /** 冷氣試算 = 冷氣度數 × 單價 */
  acEstimate: number
}

export function computeLedgerDerived(day: LedgerDay): LedgerDayDerived {
  let courtTotal = 0
  let offpeakWeekday = 0
  let offpeakLate = 0
  const wd = isWeekday(day.date)
  for (const slot of LEDGER_SLOTS) {
    const v = numericSlot(day.slots[slot.key])
    courtTotal += v
    if (slot.offpeakWeekday && wd) offpeakWeekday += v
    if (slot.late) offpeakLate += v
  }
  const salesTotal = day.merch + day.snacks + day.drinks + day.ac + day.other
  const subtotal = courtTotal + salesTotal
  const total = subtotal + day.seasonFee + day.privatePrepay + day.acFee + day.refund
  return {
    courtTotal,
    salesTotal,
    subtotal,
    total,
    offpeakWeekday,
    offpeakLate,
    offpeakTotal: offpeakWeekday + offpeakLate,
    acEstimate: day.acDegrees * LEDGER_AC_RATE,
  }
}

/** 建立一筆空白 LedgerDay（表單初始值） */
export function makeEmptyLedgerDay(venueId: string, date: string, userId: string): LedgerDay {
  return {
    venueId,
    date,
    slots: {},
    merch: 0, snacks: 0, drinks: 0, ac: 0, other: 0,
    seasonFee: 0, privatePrepay: 0, acFee: 0, refund: 0,
    acDegrees: 0,
    bookingNote: '', refundNote: '', merchNote: '',
    reported: false,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  }
}


// ── 4. 月摘要 + 對帳結果型別（client / server 共用）──────────────

export interface LedgerMonthSummary {
  venueId: string
  ym: string
  /** 該月已填的天數 */
  filledDays: number
  /** 該月已標「回報完畢」的天數 */
  reportedDays: number
  /** 月總計（Σ 每日 total） */
  monthTotal: number
  /** 月場地費加總 */
  monthCourt: number
  /** 月銷售合計 */
  monthSales: number
}

/** 由一組 LedgerDay 算月摘要（純函式，資料來源無關） */
export function summarizeLedgerMonth(venueId: string, ym: string, days: LedgerDay[]): LedgerMonthSummary {
  let monthTotal = 0, monthCourt = 0, monthSales = 0, reportedDays = 0
  for (const d of days) {
    const dv = computeLedgerDerived(d)
    monthTotal += dv.total
    monthCourt += dv.courtTotal
    monthSales += dv.salesTotal
    if (d.reported) reportedDays++
  }
  return { venueId, ym, filledDays: days.length, reportedDays, monthTotal, monthCourt, monthSales }
}

export interface LedgerCompareCell {
  ledger: number
  /** null = 系統無對應資料（不視為差異） */
  system: number | null
  /** ledger − system；system 為 null 時為 null */
  diff: number | null
}

export interface LedgerDailyCompareRow {
  date: string
  weekday: number
  reported: boolean
  /** 該日是否有館長輸入 */
  hasLedger: boolean
  court: LedgerCompareCell
  merch: LedgerCompareCell
  refund: LedgerCompareCell
}

export type LedgerMonthlyBucketKey = 'honestShop' | 'season'

export interface LedgerMonthlyCompareRow {
  key: LedgerMonthlyBucketKey
  label: string
  ledger: number
  system: number | null
  diff: number | null
}

export interface LedgerStoreOnly {
  privatePrepay: number
  acFee: number
  acDegrees: number
  acEstimate: number
  /** 盤損 = Σ冷氣費 − Σ冷氣試算 */
  acLoss: number
  other: number
}

export interface LedgerReconResult {
  venueId: string
  venueName: string
  ym: string
  rate: number
  daily: LedgerDailyCompareRow[]
  monthly: LedgerMonthlyCompareRow[]
  storeOnly: LedgerStoreOnly
  /** 是否完全沒有館長輸入（給空狀態提示用） */
  empty: boolean
  totals: {
    court: LedgerCompareCell
    merch: LedgerCompareCell
    refund: LedgerCompareCell
    /** 差異 ≠ 0 的逐日格數（場地+商品+退款） */
    flaggedCells: number
  }
}

export const ledgerCell = (ledger: number, system: number | null): LedgerCompareCell => ({
  ledger,
  system,
  diff: system === null ? null : ledger - system,
})
