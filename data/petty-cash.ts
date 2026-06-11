// ============================================================
// data/petty-cash.ts — 階段 20 M2-3：零用金台帳（年度 6 萬上限）
// ============================================================
// 規章：每館零用金年度上限 $60,000；超支 → 年終獎金扣 $5,000。
// 資料：data/store.ts 的 PETTY_CASH_ENTRIES（有種子，可 upsert 持久化）。
// 年終扣款的彙整見 data/year-end.ts（接既有 computeYearEndBonus）。
// ============================================================

import { GENERATED } from './generator'
import { getAllPettyCashEntries } from './store'
import {
  PETTY_CASH_ANNUAL_CAP, PETTY_CASH_OVERSPEND_YEAREND_PENALTY,
} from '@/types'
import type { PettyCashEntry } from '@/types'

function venueName(venueId: string): string {
  return GENERATED.venues.find(v => v.id === venueId)?.name ?? venueId
}

export interface PettyCashMonthBucket {
  month: string   // YYYY-MM
  total: number
  entries: PettyCashEntry[]
}

export interface VenuePettyCashSummary {
  venueId: string
  venueName: string
  year: number
  entries: PettyCashEntry[]
  byMonth: PettyCashMonthBucket[]
  total: number
  cap: number
  /** 剩餘額度（可為負） */
  remaining: number
  /** 是否超出年度上限 */
  overCap: boolean
  /** 超出金額（未超則 0） */
  overAmount: number
  /** 超支造成的年終扣款（超則 5,000，否則 0） */
  yearEndPenalty: number
}

export function getVenuePettyCashSummary(venueId: string, year: number): VenuePettyCashSummary {
  const entries = getAllPettyCashEntries()
    .filter(e => e.venueId === venueId && e.date.startsWith(String(year)))
    .sort((a, b) => b.date.localeCompare(a.date))

  const total = entries.reduce((s, e) => s + e.amount, 0)
  const overAmount = Math.max(0, total - PETTY_CASH_ANNUAL_CAP)
  const overCap = overAmount > 0

  const monthMap = new Map<string, PettyCashEntry[]>()
  for (const e of entries) {
    const m = e.date.slice(0, 7)
    if (!monthMap.has(m)) monthMap.set(m, [])
    monthMap.get(m)!.push(e)
  }
  const byMonth: PettyCashMonthBucket[] = [...monthMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, es]) => ({ month, total: es.reduce((s, e) => s + e.amount, 0), entries: es }))

  return {
    venueId, venueName: venueName(venueId), year, entries, byMonth,
    total, cap: PETTY_CASH_ANNUAL_CAP, remaining: PETTY_CASH_ANNUAL_CAP - total,
    overCap, overAmount,
    yearEndPenalty: overCap ? PETTY_CASH_OVERSPEND_YEAREND_PENALTY : 0,
  }
}

export function getAllVenuePettyCashSummaries(venueIds: string[], year: number): VenuePettyCashSummary[] {
  return venueIds.map(id => getVenuePettyCashSummary(id, year))
}

/** 給年終引擎用：某館某年的零用金超支扣款 */
export function getPettyCashYearEndPenalty(venueId: string, year: number): number {
  return getVenuePettyCashSummary(venueId, year).yearEndPenalty
}
