// ============================================================
// data/reports.ts — 階段 20：報表繳交追蹤（規章 3-2 + 6-3）
// ============================================================
// 職責：把「報表繳交期限表」變成可追蹤的狀態 + 逾期罰款。
//   - 準時 ontime / 遲交 late / 待繳 pending / 未繳逾期 missed
//   - 遲交或逾期未繳：每項罰 500（規章 6-3）
// 資料：data/store.ts 的 REPORT_SUBMISSIONS（有種子，可 upsert 持久化）。
// ============================================================

import { GENERATED } from './generator'
import { getAllReportSubmissions } from './store'
import { REPORT_DEFS, REPORT_LATE_PENALTY } from '@/types'
import type { ReportDef, ReportSubmission, ReportStatusKind } from '@/types'

export function reportsCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function todayDay(): number {
  return new Date().getDate()
}

export interface ReportStatusRow {
  def: ReportDef
  submission: ReportSubmission | null
  submittedDay: number | null
  status: ReportStatusKind
  /** 逾期罰款（遲交 / 逾期未繳 = 500，否則 0） */
  penalty: number
}

/** 判定單一報表狀態（給定該館該月的繳交日） */
export function classifyReport(
  def: ReportDef, submittedDay: number | null, month: string,
): { status: ReportStatusKind; penalty: number } {
  const cur = reportsCurrentMonth()
  if (submittedDay != null) {
    const status: ReportStatusKind = submittedDay <= def.dueDay ? 'ontime' : 'late'
    return { status, penalty: status === 'late' ? REPORT_LATE_PENALTY : 0 }
  }
  // 未繳：判斷是否已過期限
  let overdue: boolean
  if (month < cur) overdue = true
  else if (month > cur) overdue = false
  else overdue = todayDay() > def.dueDay
  return overdue
    ? { status: 'missed', penalty: REPORT_LATE_PENALTY }
    : { status: 'pending', penalty: 0 }
}

/** 某館某月的所有報表狀態 */
export function getVenueReportRows(venueId: string, month: string): ReportStatusRow[] {
  const subs = getAllReportSubmissions()
  return REPORT_DEFS.map(def => {
    const submission = subs.find(s => s.venueId === venueId && s.month === month && s.type === def.type) ?? null
    const submittedDay = submission?.submittedDay ?? null
    const { status, penalty } = classifyReport(def, submittedDay, month)
    return { def, submission, submittedDay, status, penalty }
  })
}

export interface VenueReportSummary {
  venueId: string
  venueName: string
  rows: ReportStatusRow[]
  ontime: number
  late: number
  pending: number
  missed: number
  /** 逾期項數（late + missed） */
  overdueCount: number
  /** 罰款合計 */
  penaltyTotal: number
}

export function getVenueReportSummary(venueId: string, month: string): VenueReportSummary {
  const venueName = GENERATED.venues.find(v => v.id === venueId)?.name ?? venueId
  const rows = getVenueReportRows(venueId, month)
  const count = (k: ReportStatusKind) => rows.filter(r => r.status === k).length
  const late = count('late')
  const missed = count('missed')
  return {
    venueId, venueName, rows,
    ontime: count('ontime'), late, pending: count('pending'), missed,
    overdueCount: late + missed,
    penaltyTotal: rows.reduce((s, r) => s + r.penalty, 0),
  }
}

/** 全部（可見）球館的彙總 */
export function getAllVenueReportSummaries(venueIds: string[], month: string): VenueReportSummary[] {
  return venueIds.map(id => getVenueReportSummary(id, month))
}
