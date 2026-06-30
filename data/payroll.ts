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


// 規章常數 + 冷門/年終/管理職純計算抽到 data/payroll-core.ts（client+server 共用）。
// 此處 re-export 保持既有 import 相容；payroll.ts 只保留「由 GENERATED 取系統值」的 wrapper。
export {
  OFFPEAK_RULE_LINKOU, OFFPEAK_RULE_OTHER, getOffPeakRule,
  OPERATING_FLOOR, getOperatingFloor,
  YEAR_END_2026, getYearEndConfig,
  computeOffPeakBonus,
} from './payroll-core'
export type {
  OffPeakBonusResult, OffPeakRevenueBonusResult, YearEndBonusResult,
  ManagerSalaryComputed, ManagerSysInputs,
} from './payroll-core'

import {
  getOperatingFloor as _floor,
  computeOffPeakRevenueBonusCore, computeYearEndBonusCore, computeManagerSalaryCore,
  type OffPeakRevenueBonusResult as _OPRBR, type YearEndBonusResult as _YEBR,
  type ManagerSalaryComputed as _MSC,
} from './payroll-core'


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

/** 冷門「時段營收」分潤獎金（store/GENERATED 版）：系統值由 GENERATED 取得，委派 core。 */
export function computeOffPeakRevenueBonus(venueId: string, month: string): _OPRBR {
  return computeOffPeakRevenueBonusCore(venueId, {
    courtRevenue: getOffPeakCourtRevenue(venueId, month),
    hotStatus: getHotZoneOpenStatus(venueId, month),
    monthlyRevenue: getSystemMonthlyVenueRevenue(venueId, month),
    floor: _floor(venueId),
  })
}

/** 年終獎金（store/GENERATED 版）：年度實收由 GENERATED 取得，委派 core。 */
export function computeYearEndBonus(venueId: string, year: number): _YEBR {
  return computeYearEndBonusCore(venueId, year, getSystemAnnualVenueRevenue(venueId, year))
}

/** 管理職薪資結算（store/GENERATED 版）：系統值由 GENERATED 取得，委派 core 公式。 */
export function computeManagerSalary(record: ManagerSalaryRecord): _MSC {
  return computeManagerSalaryCore(record, {
    offPeakOpenedCount: countOffPeakOpenedSessions(record.venueId, record.month),
    offPeakCourtRevenue: getOffPeakCourtRevenue(record.venueId, record.month),
    hotStatus: getHotZoneOpenStatus(record.venueId, record.month),
    monthlyRevenue: getSystemMonthlyVenueRevenue(record.venueId, record.month),
    floor: _floor(record.venueId),
  })
}


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
