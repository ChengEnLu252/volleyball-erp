// ============================================================
// data/payroll.ts — 階段 19：員工薪資計算（引擎 + 規章常數 + 種子）
// ============================================================
// 職責：
//   1. 規章常數：冷門場次獎金/罰則、年終獎金級距（依規章圖轉錄）
//   2. 自動取數：該館該月系統營收、冷門「開團」場數、年度營收達成率
//   3. 衍生計算：工讀生列/表小計、冷門獎金、年終獎金、管理職薪資結算
//   4. 讀取 + 種子（工讀生用規章圖人員、管理職示範一筆）
//
// 持久化在 data/store.ts（upsertPartTimerSheet / upsertManagerSalary）。
// 型別在 types/index.ts（階段 19 區塊）。
//
// ⚠️ 規章對應（業主提供之照片）：
//   - 冷門場次獎金：林口 開團≥10→1000、≥15→3000、<2→罰1000；
//                   其他館 開團≥24→1000、≥36→3000、<5→罰1000。
//   - 年終獎金 2026：各館 100%月營收基準不同，級距獎金一致
//                   （90%→3000、100%→30000、105%→60000、110%→90000）。
//   - 場館對應（依行政區）：林口=v2、八德=v5、內壢=v4、五股=v1、飛翼=v3、新竹=v6。
//   - 待業主以規章確認者：本職薪/美編/勞健保金額、臨時獎金公式、同級不同時薪之規則。
// ============================================================

import { GENERATED } from './generator'
import { getMonthlyReconciliation } from './api'
import {
  getAllPartTimerSheets, getAllManagerSalaries,
} from './store'
import type {
  PartTimerPayrollSheet, ManagerSalaryRecord,
  OffPeakBonusRule, YearEndBonusConfig,
} from '@/types'
import { computePartTimerSheetCore } from './payroll-core'

// 工讀生時薪純核心抽到 data/payroll-core.ts（client+server 共用）；此處 re-export 保持相容。
export {
  WAGE_RATIO_LIMIT_DEFAULT, WAGE_RATIO_LIMIT_HSINCHU, WAGE_RATIO_PENALTY,
  getWageRatioLimit, defaultRateForLevel, computePartTimerRow,
} from './payroll-core'
export type { PartTimerRowComputed, PartTimerSheetComputed } from './payroll-core'


// ============================================================
// 1. 規章常數
// ============================================================

/** 冷門場次獎金規則：林口（v2） */
export const OFFPEAK_RULE_LINKOU: OffPeakBonusRule = {
  fullCount: 20, tier1Open: 10, tier1Bonus: 1000, tier2Open: 15, tier2Bonus: 3000,
  minOpen: 2, penalty: 1000,
}

/** 冷門場次獎金規則：其他場館 */
export const OFFPEAK_RULE_OTHER: OffPeakBonusRule = {
  fullCount: 48, tier1Open: 24, tier1Bonus: 1000, tier2Open: 36, tier2Bonus: 3000,
  minOpen: 5, penalty: 1000,
}

/** 各館套用的冷門規則（只有林口 v2 用林口規則） */
export function getOffPeakRule(venueId: string): OffPeakBonusRule {
  return venueId === 'v2' ? OFFPEAK_RULE_LINKOU : OFFPEAK_RULE_OTHER
}

/**
 * 營運低標（月營收，含冷氣）— 規章 6-1。
 * 對應：林口=v2、八德=v5、內壢=v4、五股=v1、新莊(飛翼)=v3。
 * ⚠️ 規章 6-1 低標表未列新竹(v6)與 Ace3.0(v7)，此處暫設預設值，待業主確認。
 */
export const OPERATING_FLOOR: Record<string, number> = {
  v2: 190000, // 林口
  v5: 190000, // 八德
  v4: 200000, // 內壢
  v1: 210000, // 五股
  v3: 220000, // 新莊＝飛翼
  v6: 180000, // 新竹（規章未列，暫設）
  v7: 180000, // Ace 3.0（規章未列，暫設）
}
export function getOperatingFloor(venueId: string): number {
  return OPERATING_FLOOR[venueId] ?? 180000
}

/**
 * 年終獎金設定 2026（依規章圖轉錄；各館 100%月營收基準不同，級距獎金一致）。
 * key = venueId。
 */
export const YEAR_END_2026: Record<string, YearEndBonusConfig> = {
  v2: { baseMonthlyRevenue: 275000, tiers: stdTiers() }, // 林口
  v5: { baseMonthlyRevenue: 283333, tiers: stdTiers() }, // 八德
  v4: { baseMonthlyRevenue: 291667, tiers: stdTiers() }, // 內壢
  v1: { baseMonthlyRevenue: 350000, tiers: stdTiers() }, // 五股
  v3: { baseMonthlyRevenue: 366667, tiers: stdTiers() }, // 飛翼
  v6: { baseMonthlyRevenue: 200000, tiers: stdTiers() }, // 新竹
}

function stdTiers() {
  return [
    { achievePct: 90,  bonus: 3000 },
    { achievePct: 100, bonus: 30000 },
    { achievePct: 105, bonus: 60000 },
    { achievePct: 110, bonus: 90000 },
  ]
}

/** 取某館某年的年終設定（目前僅 2026 有資料） */
export function getYearEndConfig(venueId: string, year: number): YearEndBonusConfig | null {
  if (year === 2026) return YEAR_END_2026[venueId] ?? null
  return null
}


// ============================================================
// 2. 自動取數（從系統既有資料）
// ============================================================

/** 該館該月系統實收營收（重用月對帳的 totalActual）。 */
export function getSystemMonthlyVenueRevenue(venueId: string, month: string): number {
  const recon = getMonthlyReconciliation('month', month)
  return recon.rows.find(r => r.venueId === venueId)?.totalActual ?? 0
}

/** 該館某年（12 個月加總）系統實收營收。 */
export function getSystemAnnualVenueRevenue(venueId: string, year: number): number {
  let sum = 0
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    sum += getSystemMonthlyVenueRevenue(venueId, key)
  }
  return sum
}

/**
 * 該館該月「冷門開團場數」。
 * 冷門 = 場次所屬 Timeslot.isHotZone === false；
 * 開團 = 場次未取消（status ≠ 'cancelled'）。
 */
export function countOffPeakOpenedSessions(venueId: string, month: string): number {
  const tsHot = new Map(GENERATED.timeslots.map(t => [t.id, t.isHotZone]))
  return GENERATED.sessions.filter(s =>
    s.venueId === venueId
    && s.sessionDate.startsWith(month)
    && s.status !== 'cancelled'
    && s.timeslotId != null
    && tsHot.get(s.timeslotId) === false,
  ).length
}

/**
 * 該館該月「熱門場次是否全開」（規章 6-2：熱門場次需全開才領 20%）。
 * 全開 = 該月所屬熱門時段的場次皆未取消。
 */
export function getHotZoneOpenStatus(venueId: string, month: string): { total: number; opened: number; fullyOpen: boolean } {
  const hotTsIds = new Set(
    GENERATED.timeslots.filter(t => t.venueId === venueId && t.isHotZone).map(t => t.id),
  )
  const hot = GENERATED.sessions.filter(s =>
    s.venueId === venueId && s.sessionDate.startsWith(month) && s.timeslotId != null && hotTsIds.has(s.timeslotId),
  )
  const total = hot.length
  const opened = hot.filter(s => s.status !== 'cancelled').length
  return { total, opened, fullyOpen: total > 0 && opened === total }
}

/**
 * 該館該月「冷門時段純場地費」實收（規章 6-2 分潤基準）。
 * 由 actualRevenue 依場地費佔比剝離冷氣費（冷氣不列入分潤基準）。
 */
export function getOffPeakCourtRevenue(venueId: string, month: string): number {
  const tsHot = new Map(GENERATED.timeslots.map(t => [t.id, t.isHotZone]))
  let sum = 0
  for (const s of GENERATED.sessions) {
    if (s.venueId !== venueId || !s.sessionDate.startsWith(month) || s.status === 'cancelled') continue
    if (s.timeslotId == null || tsHot.get(s.timeslotId) !== false) continue
    const actual = s.actualRevenue ?? 0
    const court = s.courtFee ?? 0
    const ac = s.acEnabled ? (s.acFee ?? 0) : 0
    const courtShare = court + ac > 0 ? court / (court + ac) : 1
    sum += actual * courtShare
  }
  return Math.round(sum)
}


// ============================================================
// 3. 衍生計算
// ============================================================

/** 工讀生薪資表衍生計算（store/GENERATED 版）：systemRevenue 由月對帳取得，委派 core 公式。 */
export function computePartTimerSheet(sheet: PartTimerPayrollSheet) {
  return computePartTimerSheetCore(sheet, getSystemMonthlyVenueRevenue(sheet.venueId, sheet.month))
}

export interface OffPeakBonusResult {
  rule: OffPeakBonusRule
  /** 冷門開團場數 */
  openedCount: number
  /** 達到的級距：0=未達/罰款、1=tier1、2=tier2 */
  tier: 0 | 1 | 2
  /** 獎金（達標時為正） */
  bonus: number
  /** 罰款（開團數低於最少門檻時為正） */
  penalty: number
  /** 對結算的淨影響（bonus − penalty） */
  net: number
}

/** 冷門場次獎金/罰則：取最高達標級距；低於最少開團數則罰款。 */
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

export interface OffPeakRevenueBonusResult {
  /** 分潤比率：0.20 / 0.10 / 0.05 */
  rate: number
  /** 冷門時段純場地費實收（分潤基準） */
  courtRevenue: number
  /** 分潤獎金 = round(courtRevenue × rate) */
  bonus: number
  /** 熱門場次是否全開 */
  hotFullyOpen: boolean
  hotOpened: number
  hotTotal: number
  /** 月營收是否未達營運低標 */
  belowFloor: boolean
  floor: number
  monthlyRevenue: number
  /** 適用級距的說明 */
  reason: string
}

/**
 * 冷門「時段營收」分潤獎金（規章 6-2）。
 * 規則優先序：月營收未達營運低標 → 5%；否則熱門全開 → 20%、未全開 → 10%。
 */
export function computeOffPeakRevenueBonus(venueId: string, month: string): OffPeakRevenueBonusResult {
  const courtRevenue = getOffPeakCourtRevenue(venueId, month)
  const hot = getHotZoneOpenStatus(venueId, month)
  const floor = getOperatingFloor(venueId)
  const monthlyRevenue = getSystemMonthlyVenueRevenue(venueId, month)
  const belowFloor = monthlyRevenue < floor

  let rate: number
  let reason: string
  if (belowFloor) { rate = 0.05; reason = '月營收未達營運低標 → 5%' }
  else if (hot.fullyOpen) { rate = 0.20; reason = '熱門場次全開 → 20%' }
  else { rate = 0.10; reason = '熱門場次未全開 → 10%' }

  const bonus = Math.round(courtRevenue * rate)
  return {
    rate, courtRevenue, bonus,
    hotFullyOpen: hot.fullyOpen, hotOpened: hot.opened, hotTotal: hot.total,
    belowFloor, floor, monthlyRevenue, reason,
  }
}

export interface YearEndBonusResult {
  config: YearEndBonusConfig | null
  /** 年度目標（= base × 12） */
  annualTarget: number
  /** 年度實際營收（系統 12 月加總） */
  annualActual: number
  /** 達成率（%） */
  achievePct: number
  /** 目前達到的級距獎金 */
  bonus: number
  /** 達到的級距 achievePct（未達最低級距為 null） */
  reachedTierPct: number | null
}

/** 年終獎金：以系統年度營收 / 年度目標算達成率，對到最高已達級距。 */
export function computeYearEndBonus(venueId: string, year: number): YearEndBonusResult {
  const config = getYearEndConfig(venueId, year)
  const annualActual = getSystemAnnualVenueRevenue(venueId, year)
  if (!config) {
    return { config: null, annualTarget: 0, annualActual, achievePct: 0, bonus: 0, reachedTierPct: null }
  }
  const annualTarget = config.baseMonthlyRevenue * 12
  const achievePct = annualTarget > 0 ? (annualActual / annualTarget) * 100 : 0
  let bonus = 0
  let reachedTierPct: number | null = null
  for (const t of config.tiers) {
    if (achievePct >= t.achievePct) { bonus = t.bonus; reachedTierPct = t.achievePct }
  }
  return { config, annualTarget, annualActual, achievePct, bonus, reachedTierPct }
}

export interface ManagerSalaryComputed {
  record: ManagerSalaryRecord
  /** 請假扣薪 = round(baseSalary / 30 × leaveDays) */
  leaveDeduction: number
  /** 冷門場次「達標」獎金（自動，依開團數，若 includeOffPeakBonus） */
  offPeak: OffPeakBonusResult | null
  /** 冷門「時段營收」分潤獎金（自動，20/10/5%，若 includeOffPeakBonus） */
  offPeakRevenue: OffPeakRevenueBonusResult | null
  /** 收入合計（本職 + 美編 + 手動獎金 + 自動冷門達標獎 + 冷門分潤獎） */
  grossIncome: number
  /** 扣款合計（勞健保 + 請假 + 手動扣款 + 冷門罰款） */
  totalDeduction: number
  /** 實領 = 收入 − 扣款 */
  net: number
}

export function computeManagerSalary(record: ManagerSalaryRecord): ManagerSalaryComputed {
  const leaveDeduction = Math.round((record.baseSalary / 30) * record.leaveDays)

  const offPeak = record.includeOffPeakBonus
    ? computeOffPeakBonus(record.venueId, countOffPeakOpenedSessions(record.venueId, record.month))
    : null

  const offPeakRevenue = record.includeOffPeakBonus
    ? computeOffPeakRevenueBonus(record.venueId, record.month)
    : null

  const manualBonus = record.bonuses.reduce((s, b) => s + b.amount, 0)
  const manualDeduction = record.deductions.reduce((s, d) => s + d.amount, 0)

  const grossIncome = record.baseSalary + record.designPay + manualBonus
    + (offPeak?.bonus ?? 0) + (offPeakRevenue?.bonus ?? 0)
  const totalDeduction = record.insuranceSelf + leaveDeduction + manualDeduction + (offPeak?.penalty ?? 0)
  const net = grossIncome - totalDeduction

  return { record, leaveDeduction, offPeak, offPeakRevenue, grossIncome, totalDeduction, net }
}


// ============================================================
// 4. 等級 → 預設時薪（建立新列時用）
// ============================================================



// ============================================================
// 5. 種子資料 + 讀取
// ============================================================

/** 本機「當前月」（與生成器以真實 today 為錨點一致） */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

/**
 * 讀取某館某月工讀生表：先看 store（人工輸入/種子）→ 無則回空表。
 */
export function getPartTimerSheet(venueId: string, month: string): PartTimerPayrollSheet {
  const found = getAllPartTimerSheets().find(s => s.venueId === venueId && s.month === month)
  if (found) return found
  return {
    venueId, month, rows: [], revenueOverride: null,
    updatedBy: '', updatedAt: '',
  }
}

/** 讀取某館某月所有管理職薪資 */
export function getManagerSalaries(venueId: string, month: string): ManagerSalaryRecord[] {
  return getAllManagerSalaries().filter(r => r.venueId === venueId && r.month === month)
}
