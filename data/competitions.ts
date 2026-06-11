// ============================================================
// data/competitions.ts — 階段 20 M2-4：比賽企劃追蹤
// ============================================================
// 規章：每館年度 ≥ 3 場比賽企劃；內壢(v4) + 新竹(v6) 採「合計 ≥ 4」。
//       未達標 → 年終獎金扣 $3,000（合計組未達 → 該組兩館各扣）。
// ⚠️ 「合計 4」是否取代兩館各自 ≥3，規章未明，採合計判定，待業主確認。
// 「企劃數」計入 status ≠ 'cancelled'（規劃中 + 已舉辦皆算已排定企劃）。
// 資料：data/store.ts 的 COMPETITION_PLANS（有種子，可 upsert 持久化）。
// 年終扣款彙整見 data/year-end.ts。
// ============================================================

import { GENERATED } from './generator'
import { getAllCompetitionPlans } from './store'
import {
  COMPETITION_MIN_PER_VENUE, COMPETITION_COMBINED_GROUP,
  COMPETITION_COMBINED_TARGET, COMPETITION_SHORTFALL_YEAREND_PENALTY,
} from '@/types'
import type { CompetitionPlan } from '@/types'

function venueName(venueId: string): string {
  return GENERATED.venues.find(v => v.id === venueId)?.name ?? venueId
}

/** 某館某年「已排定」企劃（規劃中 + 已舉辦，排除取消） */
export function getVenuePlans(venueId: string, year: number): CompetitionPlan[] {
  return getAllCompetitionPlans()
    .filter(p => p.venueId === venueId && p.date.startsWith(String(year)) && p.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface VenueCompetitionStatus {
  venueId: string
  venueName: string
  year: number
  plans: CompetitionPlan[]
  /** 已排定企劃數（含規劃中） */
  count: number
  /** 已舉辦數 */
  doneCount: number
  /** 適用門檻（合計組顯示組門檻） */
  target: number
  /** 是否屬合計組（內壢 + 新竹） */
  inCombinedGroup: boolean
  /** 是否達標（合計組以組計） */
  met: boolean
  /** 未達標的年終扣款（$3,000 或 0） */
  yearEndPenalty: number
}

export function getVenueCompetitionStatus(venueId: string, year: number): VenueCompetitionStatus {
  const inGroup = COMPETITION_COMBINED_GROUP.includes(venueId)
  const plans = getVenuePlans(venueId, year)
  const count = plans.length
  const doneCount = plans.filter(p => p.status === 'done').length

  let target: number
  let met: boolean
  if (inGroup) {
    target = COMPETITION_COMBINED_TARGET
    const groupCount = COMPETITION_COMBINED_GROUP
      .reduce((s, vid) => s + getVenuePlans(vid, year).length, 0)
    met = groupCount >= COMPETITION_COMBINED_TARGET
  } else {
    target = COMPETITION_MIN_PER_VENUE
    met = count >= COMPETITION_MIN_PER_VENUE
  }

  return {
    venueId, venueName: venueName(venueId), year, plans, count, doneCount,
    target, inCombinedGroup: inGroup, met,
    yearEndPenalty: met ? 0 : COMPETITION_SHORTFALL_YEAREND_PENALTY,
  }
}

export function getAllVenueCompetitionStatuses(venueIds: string[], year: number): VenueCompetitionStatus[] {
  return venueIds.map(id => getVenueCompetitionStatus(id, year))
}

/** 合計組（內壢 + 新竹）目前合計企劃數 */
export function getCombinedGroupCount(year: number): number {
  return COMPETITION_COMBINED_GROUP.reduce((s, vid) => s + getVenuePlans(vid, year).length, 0)
}

/** 給年終引擎用：某館某年比賽未達標扣款 */
export function getCompetitionYearEndPenalty(venueId: string, year: number): number {
  return getVenueCompetitionStatus(venueId, year).yearEndPenalty
}
