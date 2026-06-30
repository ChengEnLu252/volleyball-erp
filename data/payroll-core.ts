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

// ============================================================
// P2.3b 管理職 / 冷門 / 年終：純核心（系統推導值一律由呼叫端注入）
// ============================================================

import type { OffPeakBonusRule, YearEndBonusConfig, ManagerSalaryRecord } from '@/types'

// ── 規章常數：冷門場次獎金規則 ─────────────────────────────────
export const OFFPEAK_RULE_LINKOU: OffPeakBonusRule = {
  fullCount: 20, tier1Open: 10, tier1Bonus: 1000, tier2Open: 15, tier2Bonus: 3000,
  minOpen: 2, penalty: 1000,
}
export const OFFPEAK_RULE_OTHER: OffPeakBonusRule = {
  fullCount: 48, tier1Open: 24, tier1Bonus: 1000, tier2Open: 36, tier2Bonus: 3000,
  minOpen: 5, penalty: 1000,
}
/** 各館套用的冷門規則（只有林口 v2 用林口規則） */
export function getOffPeakRule(venueId: string): OffPeakBonusRule {
  return venueId === 'v2' ? OFFPEAK_RULE_LINKOU : OFFPEAK_RULE_OTHER
}

// ── 規章常數：營運低標（6-1）──────────────────────────────────
export const OPERATING_FLOOR: Record<string, number> = {
  v2: 190000, v5: 190000, v4: 200000, v1: 210000, v3: 220000, v6: 180000, v7: 180000,
}
export function getOperatingFloor(venueId: string): number {
  return OPERATING_FLOOR[venueId] ?? 180000
}

// ── 規章常數：年終獎金 2026 ───────────────────────────────────
function stdTiers() {
  return [
    { achievePct: 90,  bonus: 3000 },
    { achievePct: 100, bonus: 30000 },
    { achievePct: 105, bonus: 60000 },
    { achievePct: 110, bonus: 90000 },
  ]
}
export const YEAR_END_2026: Record<string, YearEndBonusConfig> = {
  v2: { baseMonthlyRevenue: 275000, tiers: stdTiers() },
  v5: { baseMonthlyRevenue: 283333, tiers: stdTiers() },
  v4: { baseMonthlyRevenue: 291667, tiers: stdTiers() },
  v1: { baseMonthlyRevenue: 350000, tiers: stdTiers() },
  v3: { baseMonthlyRevenue: 366667, tiers: stdTiers() },
  v6: { baseMonthlyRevenue: 200000, tiers: stdTiers() },
}
export function getYearEndConfig(venueId: string, year: number): YearEndBonusConfig | null {
  if (year === 2026) return YEAR_END_2026[venueId] ?? null
  return null
}

// ── 冷門場次「達標」獎金（純） ─────────────────────────────────
export interface OffPeakBonusResult {
  rule: OffPeakBonusRule
  openedCount: number
  tier: 0 | 1 | 2
  bonus: number
  penalty: number
  net: number
}
export function computeOffPeakBonus(venueId: string, openedCount: number): OffPeakBonusResult {
  const rule = getOffPeakRule(venueId)
  let tier: 0 | 1 | 2 = 0
  let bonus = 0
  let penalty = 0
  if (openedCount >= rule.tier2Open) { tier = 2; bonus = rule.tier2Bonus }
  else if (openedCount >= rule.tier1Open) { tier = 1; bonus = rule.tier1Bonus }
  else if (openedCount < rule.minOpen) { penalty = rule.penalty }
  return { rule, openedCount, tier, bonus, penalty, net: bonus - penalty }
}

// ── 冷門「時段營收」分潤獎金（注入系統值） ───────────────────────
export interface OffPeakRevenueBonusResult {
  rate: number
  courtRevenue: number
  bonus: number
  hotFullyOpen: boolean
  hotOpened: number
  hotTotal: number
  belowFloor: boolean
  floor: number
  monthlyRevenue: number
  reason: string
}
export interface OffPeakRevenueSysInputs {
  /** 冷門時段純場地費實收 */
  courtRevenue: number
  /** 熱門場次開團狀態 */
  hotStatus: { total: number; opened: number; fullyOpen: boolean }
  /** 月營收（系統） */
  monthlyRevenue: number
  /** 營運低標 */
  floor: number
}
/** 規章 6-2：未達低標→5%；否則熱門全開→20%、未全開→10%。公式不變，系統值注入。 */
export function computeOffPeakRevenueBonusCore(venueId: string, sys: OffPeakRevenueSysInputs): OffPeakRevenueBonusResult {
  void venueId
  const { courtRevenue, hotStatus, monthlyRevenue, floor } = sys
  const belowFloor = monthlyRevenue < floor
  let rate: number
  let reason: string
  if (belowFloor) { rate = 0.05; reason = '月營收未達營運低標 → 5%' }
  else if (hotStatus.fullyOpen) { rate = 0.20; reason = '熱門場次全開 → 20%' }
  else { rate = 0.10; reason = '熱門場次未全開 → 10%' }
  const bonus = Math.round(courtRevenue * rate)
  return {
    rate, courtRevenue, bonus,
    hotFullyOpen: hotStatus.fullyOpen, hotOpened: hotStatus.opened, hotTotal: hotStatus.total,
    belowFloor, floor, monthlyRevenue, reason,
  }
}

// ── 年終獎金（注入年度實收） ───────────────────────────────────
export interface YearEndBonusResult {
  config: YearEndBonusConfig | null
  annualTarget: number
  annualActual: number
  achievePct: number
  bonus: number
  reachedTierPct: number | null
}
export function computeYearEndBonusCore(venueId: string, year: number, annualActual: number): YearEndBonusResult {
  const config = getYearEndConfig(venueId, year)
  if (!config) return { config: null, annualTarget: 0, annualActual, achievePct: 0, bonus: 0, reachedTierPct: null }
  const annualTarget = config.baseMonthlyRevenue * 12
  const achievePct = annualTarget > 0 ? (annualActual / annualTarget) * 100 : 0
  let bonus = 0
  let reachedTierPct: number | null = null
  for (const t of config.tiers) {
    if (achievePct >= t.achievePct) { bonus = t.bonus; reachedTierPct = t.achievePct }
  }
  return { config, annualTarget, annualActual, achievePct, bonus, reachedTierPct }
}

// ── 管理職薪資（注入系統值） ───────────────────────────────────
export interface ManagerSalaryComputed {
  record: ManagerSalaryRecord
  leaveDeduction: number
  offPeak: OffPeakBonusResult | null
  offPeakRevenue: OffPeakRevenueBonusResult | null
  grossIncome: number
  totalDeduction: number
  net: number
}
export interface ManagerSysInputs {
  /** 冷門開團場數 */
  offPeakOpenedCount: number
  /** 冷門純場地費實收 */
  offPeakCourtRevenue: number
  /** 熱門場次開團狀態 */
  hotStatus: { total: number; opened: number; fullyOpen: boolean }
  /** 月營收（系統） */
  monthlyRevenue: number
  /** 營運低標 */
  floor: number
}
/** 管理職薪資結算（規章；公式不變，系統值由 sys 注入）。 */
export function computeManagerSalaryCore(record: ManagerSalaryRecord, sys: ManagerSysInputs): ManagerSalaryComputed {
  const leaveDeduction = Math.round((record.baseSalary / 30) * record.leaveDays)

  const offPeak = record.includeOffPeakBonus
    ? computeOffPeakBonus(record.venueId, sys.offPeakOpenedCount)
    : null

  const offPeakRevenue = record.includeOffPeakBonus
    ? computeOffPeakRevenueBonusCore(record.venueId, {
        courtRevenue: sys.offPeakCourtRevenue, hotStatus: sys.hotStatus,
        monthlyRevenue: sys.monthlyRevenue, floor: sys.floor,
      })
    : null

  const manualBonus = record.bonuses.reduce((s, b) => s + b.amount, 0)
  const manualDeduction = record.deductions.reduce((s, d) => s + d.amount, 0)

  const grossIncome = record.baseSalary + record.designPay + manualBonus
    + (offPeak?.bonus ?? 0) + (offPeakRevenue?.bonus ?? 0)
  const totalDeduction = record.insuranceSelf + leaveDeduction + manualDeduction + (offPeak?.penalty ?? 0)
  const net = grossIncome - totalDeduction

  return { record, leaveDeduction, offPeak, offPeakRevenue, grossIncome, totalDeduction, net }
}
