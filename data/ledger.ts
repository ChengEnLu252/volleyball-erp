// ============================================================
// data/ledger.ts — 月記帳：store/generator 版對帳（Phase-2 過渡）
// ============================================================
// P2.2d 後，純設定常數 / 衍生計算 / 對帳結果型別已抽到 data/ledger-core.ts
//   （client + server 共用，無 store/generator 相依），此檔 re-export 之以保持相容。
//
// 本檔保留「系統側數字取自 GENERATED 假資料 + store 記帳」的舊版對帳
//   （getLedgerReconciliation），目前僅 data/ledger-anomalies.ts（仍走 store 的
//   財務異常清單）使用。月記帳輸入/對帳頁已改走 DB（data/server/queries.ts）。
// ============================================================

import { GENERATED } from './generator'
import { getAllLedgerDays } from './store'
import { getMonthlyReconciliation } from './api'
import {
  LEDGER_AC_RATE,
  LEDGER_SLOTS,
  computeLedgerDerived,
  weekdayOf,
  summarizeLedgerMonth,
  ledgerCell as cell,
  type LedgerCompareCell,
  type LedgerDailyCompareRow,
  type LedgerMonthlyBucketKey,
  type LedgerMonthSummary,
  type LedgerReconResult,
  type LedgerStoreOnly,
} from './ledger-core'
import type { LedgerDay } from '@/types'

// ── re-export 純核心，保持既有 import { ... } from '@/data/ledger' 不破 ──
export {
  LEDGER_AC_RATE,
  LEDGER_SLOTS,
  LEDGER_CATEGORY_FIELDS,
  LEDGER_CHARGE_FIELDS,
  numericSlot,
  isWeekday,
  weekdayOf,
  daysInMonth,
  computeLedgerDerived,
  makeEmptyLedgerDay,
  summarizeLedgerMonth,
} from './ledger-core'
export type {
  SlotKind,
  LedgerSlotDef,
  LedgerDayDerived,
  LedgerMonthSummary,
  LedgerCompareCell,
  LedgerDailyCompareRow,
  LedgerMonthlyBucketKey,
  LedgerMonthlyCompareRow,
  LedgerStoreOnly,
  LedgerReconResult,
} from './ledger-core'


// ── 讀取（store 版；Phase-2 過渡用）─────────────────────────────

const dayDate = (iso: string): string => iso.slice(0, 10)

/** 取某館某日的記帳（無則回 null） */
export function getLedgerDay(venueId: string, date: string): LedgerDay | null {
  return getAllLedgerDays().find(d => d.venueId === venueId && d.date === date) ?? null
}

/** 取某館某月所有已填日（照日期排序）+ 月摘要 */
export function getLedgerMonth(venueId: string, ym: string): {
  days: LedgerDay[]
  summary: LedgerMonthSummary
} {
  const days = getAllLedgerDays()
    .filter(d => d.venueId === venueId && d.date.slice(0, 7) === ym)
    .sort((a, b) => a.date.localeCompare(b.date))
  return { days, summary: summarizeLedgerMonth(venueId, ym, days) }
}


// ── 系統側每日數字（從 GENERATED 假資料計算）────────────────────

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


// ── 對帳主函式（store 版）──────────────────────────────────────

/**
 * 月對帳主函式（store/generator 版）。
 *
 * 逐日：場地費 / 商品 / 退款（系統有逐日資料）。
 * 逐月：飲料+零食（誠實商店）/ 季打收費（季租分攤）。
 * 只存不比：包場預付 / 冷氣費 / 冷氣度數 / 盤損 / 其他。
 */
export function getLedgerReconciliation(venueId: string, ym: string): LedgerReconResult {
  const venueName = GENERATED.venues.find(v => v.id === venueId)?.name ?? '?'
  const { days } = getLedgerMonth(venueId, ym)
  const byDate = new Map(days.map(d => [d.date, d]))

  const courtSys  = systemCourtByDay(venueId, ym)
  const merchSys  = systemMerchByDay(venueId, ym)
  const refundSys = systemRefundByDay(venueId, ym)

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

  const drinksSnacks = days.reduce((s, d) => s + d.drinks + d.snacks, 0)
  const seasonLedger = days.reduce((s, d) => s + d.seasonFee, 0)
  const monthlyRaw: Array<{ key: LedgerMonthlyBucketKey; label: string; ledger: number; system: number | null }> = [
    { key: 'honestShop', label: '飲料 + 零食（誠實商店）', ledger: drinksSnacks, system: systemHonestShopMonth(venueId, ym) },
    { key: 'season',     label: '季打收費（季租實收）',   ledger: seasonLedger, system: systemSeasonMonth(venueId, ym) },
  ]
  const monthly = monthlyRaw.map(r => ({ ...r, diff: r.system === null ? null : r.ledger - r.system }))

  const acFeeSum = days.reduce((s, d) => s + d.acFee, 0)
  const acDegSum = days.reduce((s, d) => s + d.acDegrees, 0)
  const acEstSum = acDegSum * LEDGER_AC_RATE
  const storeOnly: LedgerStoreOnly = {
    privatePrepay: days.reduce((s, d) => s + d.privatePrepay, 0),
    acFee: acFeeSum,
    acDegrees: acDegSum,
    acEstimate: acEstSum,
    acLoss: acFeeSum - acEstSum,
    other: days.reduce((s, d) => s + d.other, 0),
  }

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
