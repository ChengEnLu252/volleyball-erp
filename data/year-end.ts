// ============================================================
// data/year-end.ts — 階段 20 M2：年終獎金「實得展望」彙整
// ============================================================
// 接既有年終引擎（computeYearEndBonus），再扣除 M2 新增的兩項年度罰則：
//   - 零用金超支（> $60,000）：扣 $5,000（data/petty-cash.ts）
//   - 比賽企劃未達標：扣 $3,000（data/competitions.ts）
// 不修改 computeYearEndBonus 本體（純加法包裝），避免影響階段 19 管理職頁面。
// ============================================================

import { computeYearEndBonus } from './payroll'
import type { YearEndBonusResult } from './payroll'
import { getPettyCashYearEndPenalty } from './petty-cash'
import { getCompetitionYearEndPenalty } from './competitions'

export interface YearEndDeduction {
  label: string
  amount: number
}

export interface YearEndOutlook {
  bonus: YearEndBonusResult
  /** 級距獎金（= bonus.bonus） */
  grossBonus: number
  deductions: YearEndDeduction[]
  totalDeduction: number
  /** 實得年終 = 級距獎金 − 扣款（不為負） */
  net: number
}

export function computeYearEndOutlook(venueId: string, year: number): YearEndOutlook {
  const bonus = computeYearEndBonus(venueId, year)
  const grossBonus = bonus.bonus

  const deductions: YearEndDeduction[] = []
  const petty = getPettyCashYearEndPenalty(venueId, year)
  if (petty > 0) deductions.push({ label: '零用金超出年度上限', amount: petty })
  const comp = getCompetitionYearEndPenalty(venueId, year)
  if (comp > 0) deductions.push({ label: '比賽企劃未達標', amount: comp })

  const totalDeduction = deductions.reduce((s, d) => s + d.amount, 0)
  return {
    bonus, grossBonus, deductions, totalDeduction,
    net: Math.max(0, grossBonus - totalDeduction),
  }
}
