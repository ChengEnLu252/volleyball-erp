// ============================================================
// data/ledger.ts — 階段 18：月記帳表（讀取 + 衍生計算 + 對帳比對）
// ============================================================
// 此檔的職責：
//   1. 時段 / 類別設定（對應 Excel「多爾森記帳表」的列）
//   2. 每日衍生計算（小計 / 總計 / 場地費加總 / 冷門 / 冷氣試算）
//      —— 數字定義與 Excel 一致（不複製 Excel 內個別欄位的 off-by-one 筆誤）
//   3. 讀取：getLedgerDay / getLedgerMonth / makeEmptyLedgerDay
//   4. 對帳：getLedgerReconciliation —— 把館長輸入的數字與系統既有資料
//      （場次 / 商品 / 誠實商店 / 季租 / 退款）自動比對找差異
//
// 持久化在 data/store.ts（upsertLedgerDay / getAllLedgerDays）。
// 型別 LedgerDay 在 types/index.ts。
//
// 比對顆粒度（依資料可得性）：
//   - 逐日比：場地費↔場次實收、商品↔商品銷售(非誠實商店)、退款↔負額收款
//   - 逐月比：飲料+零食↔誠實商店、季打收費↔季租實收(按比例分攤)
//   - 只存不比：包場預付 / 冷氣費 / 冷氣度數 / 盤損 / 其他
// ============================================================

import { GENERATED } from './generator'
import { getAllLedgerDays } from './store'
import { getMonthlyReconciliation } from './api'
import type { LedgerDay, LedgerSlotValue } from '@/types'


// ============================================================
// 1. 設定常數
// ============================================================

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


// ============================================================
// 2. 小工具
// ============================================================

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

const dayDate = (iso: string): string => iso.slice(0, 10)


// ============================================================
// 3. 每日衍生計算（與 Excel 定義一致）
// ============================================================

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


// ============================================================
// 4. 讀取
// ============================================================

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

/** 取某館某日的記帳（無則回 null） */
export function getLedgerDay(venueId: string, date: string): LedgerDay | null {
  return getAllLedgerDays().find(d => d.venueId === venueId && d.date === date) ?? null
}

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

/** 取某館某月所有已填日（照日期排序）+ 月摘要 */
export function getLedgerMonth(venueId: string, ym: string): {
  days: LedgerDay[]
  summary: LedgerMonthSummary
} {
  const days = getAllLedgerDays()
    .filter(d => d.venueId === venueId && d.date.slice(0, 7) === ym)
    .sort((a, b) => a.date.localeCompare(b.date))

  let monthTotal = 0, monthCourt = 0, monthSales = 0, reportedDays = 0
  for (const d of days) {
    const dv = computeLedgerDerived(d)
    monthTotal += dv.total
    monthCourt += dv.courtTotal
    monthSales += dv.salesTotal
    if (d.reported) reportedDays++
  }
  return {
    days,
    summary: {
      venueId, ym,
      filledDays: days.length,
      reportedDays,
      monthTotal, monthCourt, monthSales,
    },
  }
}


// ============================================================
// 5. 系統側每日數字（從既有資料計算）
// ============================================================

const honestProductIds = (): Set<string> =>
  new Set(GENERATED.products.filter(p => p.isHonestShop).map(p => p.id))

/** 某館某月：場次實收，按日彙總（YYYY-MM-DD → 金額） */
function systemCourtByDay(venueId: string, ym: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of GENERATED.sessions) {
    if (s.venueId !== venueId) continue
    if (s.sessionDate.slice(0, 7) !== ym) continue
    map.set(s.sessionDate, (map.get(s.sessionDate) ?? 0) + (s.actualRevenue ?? 0))
  }
  return map
}

/** 某館某月：商品銷售（排除誠實商店商品），按日彙總 */
function systemMerchByDay(venueId: string, ym: string): Map<string, number> {
  const honest = honestProductIds()
  const map = new Map<string, number>()
  for (const t of GENERATED.productTransactions) {
    if (t.venueId !== venueId || t.type !== 'sale') continue
    if (honest.has(t.productId)) continue
    const d = dayDate(t.operatedAt)
    if (d.slice(0, 7) !== ym) continue
    map.set(d, (map.get(d) ?? 0) + (t.totalAmount ?? 0))
  }
  return map
}

/** 某館某月：退款（負額收款的絕對值），按日彙總 */
function systemRefundByDay(venueId: string, ym: string): Map<string, number> {
  const regById = new Map(GENERATED.registrations.map(r => [r.id, r]))
  const sessById = new Map(GENERATED.sessions.map(s => [s.id, s]))
  const map = new Map<string, number>()
  for (const p of GENERATED.payments) {
    if (p.amount >= 0) continue
    const reg = regById.get(p.registrationId)
    const sess = reg ? sessById.get(reg.sessionId) : undefined
    if (!sess || sess.venueId !== venueId) continue
    const d = dayDate(p.paidAt)
    if (d.slice(0, 7) !== ym) continue
    map.set(d, (map.get(d) ?? 0) + Math.abs(p.amount))
  }
  return map
}

/** 某館某月：誠實商店銷售（誠實商店商品 sale 金額）— 月合計；無資料回 null */
function systemHonestShopMonth(venueId: string, ym: string): number | null {
  const honest = honestProductIds()
  if (honest.size === 0) return null
  let sum = 0
  let any = false
  for (const t of GENERATED.productTransactions) {
    if (t.venueId !== venueId || t.type !== 'sale') continue
    if (!honest.has(t.productId)) continue
    if (dayDate(t.operatedAt).slice(0, 7) !== ym) continue
    sum += t.totalAmount ?? 0
    any = true
  }
  return any ? sum : null
}

/** 某館某月：季租實收（按比例分攤）— 取自既有月結對帳 */
function systemSeasonMonth(venueId: string, ym: string): number {
  const r = getMonthlyReconciliation('month', ym).rows.find(x => x.venueId === venueId)
  return r?.rentalActualPaid ?? 0
}


// ============================================================
// 6. 對帳結果
// ============================================================

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

const cell = (ledger: number, system: number | null): LedgerCompareCell => ({
  ledger,
  system,
  diff: system === null ? null : ledger - system,
})

/**
 * 月對帳主函式。
 *
 * 逐日：場地費 / 商品 / 退款（系統有逐日資料）。
 * 逐月：飲料+零食（誠實商店）/ 季打收費（季租分攤）。
 * 只存不比：包場預付 / 冷氣費 / 冷氣度數 / 盤損 / 其他。
 *
 * 差異判定：diff ≠ 0 → 由 UI 標紅（system 為 null 不算差異）。
 */
export function getLedgerReconciliation(venueId: string, ym: string): LedgerReconResult {
  const venueName = GENERATED.venues.find(v => v.id === venueId)?.name ?? '?'
  const { days } = getLedgerMonth(venueId, ym)
  const byDate = new Map(days.map(d => [d.date, d]))

  const courtSys  = systemCourtByDay(venueId, ym)
  const merchSys  = systemMerchByDay(venueId, ym)
  const refundSys = systemRefundByDay(venueId, ym)

  // 逐日列（只列出「館長有填」或「系統有資料」的日子，避免整月空列）
  const relevantDates = new Set<string>([
    ...byDate.keys(),
    ...courtSys.keys(),
    ...merchSys.keys(),
    ...refundSys.keys(),
  ])
  const daily: LedgerDailyCompareRow[] = [...relevantDates]
    .sort((a, b) => a.localeCompare(b))
    .map(date => {
      const d = byDate.get(date)
      const dv = d ? computeLedgerDerived(d) : null
      return {
        date,
        weekday: weekdayOf(date),
        reported: d?.reported ?? false,
        hasLedger: !!d,
        court:  cell(dv?.courtTotal ?? 0, courtSys.get(date)  ?? 0),
        merch:  cell(d?.merch ?? 0,       merchSys.get(date)  ?? 0),
        refund: cell(d?.refund ?? 0,      refundSys.get(date) ?? 0),
      }
    })

  // 逐月桶
  const drinksSnacks = days.reduce((s, d) => s + d.drinks + d.snacks, 0)
  const seasonLedger = days.reduce((s, d) => s + d.seasonFee, 0)
  const monthlyRaw: Array<{ key: LedgerMonthlyBucketKey; label: string; ledger: number; system: number | null }> = [
    {
      key: 'honestShop',
      label: '飲料 + 零食（誠實商店）',
      ledger: drinksSnacks,
      system: systemHonestShopMonth(venueId, ym),
    },
    {
      key: 'season',
      label: '季打收費（季租實收）',
      ledger: seasonLedger,
      system: systemSeasonMonth(venueId, ym),
    },
  ]
  const monthly: LedgerMonthlyCompareRow[] = monthlyRaw.map(r => ({
    ...r,
    diff: r.system === null ? null : r.ledger - r.system,
  }))

  // 只存不比
  const acFeeSum    = days.reduce((s, d) => s + d.acFee, 0)
  const acDegSum    = days.reduce((s, d) => s + d.acDegrees, 0)
  const acEstSum    = acDegSum * LEDGER_AC_RATE
  const storeOnly: LedgerStoreOnly = {
    privatePrepay: days.reduce((s, d) => s + d.privatePrepay, 0),
    acFee: acFeeSum,
    acDegrees: acDegSum,
    acEstimate: acEstSum,
    acLoss: acFeeSum - acEstSum,
    other: days.reduce((s, d) => s + d.other, 0),
  }

  // 月加總（逐日桶）
  const sum = (sel: (r: LedgerDailyCompareRow) => LedgerCompareCell) => {
    let l = 0, s = 0
    for (const row of daily) { l += sel(row).ledger; s += sel(row).system ?? 0 }
    return cell(l, s)
  }
  const flaggedCells = daily.reduce((n, r) =>
    n + [r.court, r.merch, r.refund].filter(c => c.diff !== null && c.diff !== 0).length, 0)

  return {
    venueId, venueName, ym, rate: LEDGER_AC_RATE,
    daily, monthly, storeOnly,
    empty: days.length === 0,
    totals: {
      court:  sum(r => r.court),
      merch:  sum(r => r.merch),
      refund: sum(r => r.refund),
      flaggedCells,
    },
  }
}
