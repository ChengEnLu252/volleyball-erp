// ============================================================
// data/payroll-core.ts — 薪資「純計算核心」（無 generator/store/api 相依）
// ------------------------------------------------------------
// P2.3：把 data/payroll.ts 內「規章常數 + 純衍生計算」抽出，讓 server
//   （data/server/queries.ts，server-only）與 client 共用同一份公式。
//   ⚠️ 計算公式與規章完全一致、不變更；差別只在「系統推導數字」改成
//   由呼叫端注入（server 端查 DB，原 payroll.ts 仍由 GENERATED 取得）。
//
// 本檔目前涵蓋 P2.3a 工讀生時薪所需；管理職/冷門/年終的純核心於 P2.3b 補入。
// ============================================================

import type { PartTimerRow, PartTimerPayrollSheet, StaffLevel, UUID } from '@/types'
import { STAFF_LEVEL_DEFAULT_RATE } from '@/types'

// ── 規章常數：薪資比例上限（6-3 成本控管）──────────────────────
export const WAGE_RATIO_LIMIT_DEFAULT = 0.11
export const WAGE_RATIO_LIMIT_HSINCHU = 0.12
export const WAGE_RATIO_PENALTY = 1000

/** 新竹館（v6）上限 12%，其餘 11%。 */
export function getWageRatioLimit(venueId: string): number {
  return venueId === 'v6' ? WAGE_RATIO_LIMIT_HSINCHU : WAGE_RATIO_LIMIT_DEFAULT
}

/** 等級 → 預設時薪（建立新列時用） */
export function defaultRateForLevel(level: StaffLevel): number {
  return STAFF_LEVEL_DEFAULT_RATE[level]
}

// ── 工讀生時薪：純衍生計算 ─────────────────────────────────────
export interface PartTimerRowComputed extends PartTimerRow {
  /** 正常薪水 = 時數 × 時薪 */
  normalSalary: number
  /** 總薪水 = 正常薪水 + 獎金 − 罰款 */
  total: number
}

export function computePartTimerRow(row: PartTimerRow): PartTimerRowComputed {
  const normalSalary = Math.round(row.normalHours * row.hourlyRate)
  const total = normalSalary + row.bonus - row.penalty
  return { ...row, normalSalary, total }
}

export interface PartTimerSheetComputed {
  venueId: UUID
  month: string
  rows: PartTimerRowComputed[]
  /** 本月薪水（各列 total 加總） */
  monthTotal: number
  /** 本月營收（人工覆寫優先，否則系統值） */
  revenue: number
  /** 本月營收是否來自系統（非人工覆寫） */
  revenueFromSystem: boolean
  /** 系統營收（供對照） */
  systemRevenue: number
  /** 薪資比例 = 本月薪水 / 本月營收 */
  ratio: number
  /** 比例上限（規章 6-3：一般 11%、新竹 12%） */
  ratioLimit: number
  /** 是否超過上限 */
  overLimit: boolean
  /** 超標罰款（規章 6-3：該月 1,000 元） */
  wageRatioPenalty: number
}

/**
 * 工讀生薪資表衍生計算。
 * systemRevenue 由呼叫端注入（payroll.ts 用 GENERATED，server 用 DB）—— 公式不變。
 */
export function computePartTimerSheetCore(
  sheet: PartTimerPayrollSheet,
  systemRevenue: number,
): PartTimerSheetComputed {
  const rows = sheet.rows.map(computePartTimerRow)
  const monthTotal = rows.reduce((s, r) => s + r.total, 0)
  const revenueFromSystem = sheet.revenueOverride == null
  const revenue = revenueFromSystem ? systemRevenue : sheet.revenueOverride!
  const ratio = revenue > 0 ? monthTotal / revenue : 0
  const ratioLimit = getWageRatioLimit(sheet.venueId)
  const overLimit = ratio > ratioLimit
  const wageRatioPenalty = overLimit ? WAGE_RATIO_PENALTY : 0
  return {
    venueId: sheet.venueId, month: sheet.month, rows, monthTotal,
    revenue, revenueFromSystem, systemRevenue, ratio,
    ratioLimit, overLimit, wageRatioPenalty,
  }
}
