// ============================================================
// data/procurement.ts — 階段 20 M2-2：採購 / 修繕分級簽核
// ============================================================
// 規章金額級距：
//   < $2,000           → 館長自核（self）
//   $2,000 – $5,000    → 老闆核准（owner）
//   > $5,000           → 老闆核准 + 強制完工存證（owner_strict；修繕單須附完工照）
// ⚠️ 「每級核准人」規章正文未明列，此為合理推定，頁面標註待業主確認。
// 資料：data/store.ts 的 PROCUREMENT_REQUESTS（有種子，可 upsert 持久化）。
// ============================================================

import { GENERATED } from './generator'
import { getAllProcurementRequests } from './store'
import {
  PROCUREMENT_TIER_1, PROCUREMENT_TIER_2,
} from '@/types'
import type {
  ProcurementRequest, ProcurementTier, ProcurementStatus,
} from '@/types'
import type { EffectiveRole } from './permissions'

/** 金額 → 簽核級距 */
export function getApprovalTier(amount: number): ProcurementTier {
  if (amount < PROCUREMENT_TIER_1) return 'self'
  if (amount <= PROCUREMENT_TIER_2) return 'owner'
  return 'owner_strict'
}

/** 此級距是否需要老闆核准 */
export function requiresOwner(tier: ProcurementTier): boolean {
  return tier !== 'self'
}

/** 此級距是否強制完工存證（> $5,000） */
export function requiresCompletionEvidence(tier: ProcurementTier): boolean {
  return tier === 'owner_strict'
}

/** 某角色能否核准此級距（合理推定，待業主確認） */
export function canApprove(role: EffectiveRole, tier: ProcurementTier): boolean {
  if (role === 'owner') return true       // 老闆可核全部級距
  if (role === 'manager') return tier === 'self' // 館長僅可自核 < $2,000
  return false
}

/** 是否為「待簽核」狀態（需要有人按核准 / 退回） */
export function isPending(req: ProcurementRequest): boolean {
  return req.status === 'pending' || req.status === 'draft'
}

/** 是否完工存證不足（> $5,000 已核准但尚無完工照 / 未完工） */
export function isEvidenceMissing(req: ProcurementRequest): boolean {
  return req.kind === 'repair'
    && requiresCompletionEvidence(getApprovalTier(req.amount))
    && req.status === 'approved'
    && !req.completionEvidenceRef
}

export interface VenueProcurementSummary {
  venueId: string
  venueName: string
  requests: ProcurementRequest[]
  pendingCount: number
  approvedAmount: number   // 已核准 + 已完工金額合計
  evidenceMissingCount: number
}

function venueName(venueId: string): string {
  return GENERATED.venues.find(v => v.id === venueId)?.name ?? venueId
}

export function getVenueProcurementSummary(venueId: string): VenueProcurementSummary {
  const requests = getAllProcurementRequests()
    .filter(r => r.venueId === venueId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  return {
    venueId,
    venueName: venueName(venueId),
    requests,
    pendingCount: requests.filter(isPending).length,
    approvedAmount: requests
      .filter(r => r.status === 'approved' || r.status === 'completed')
      .reduce((s, r) => s + r.amount, 0),
    evidenceMissingCount: requests.filter(isEvidenceMissing).length,
  }
}

export function getAllVenueProcurementSummaries(venueIds: string[]): VenueProcurementSummary[] {
  return venueIds.map(getVenueProcurementSummary)
}

/** 狀態流轉：核准 */
export function approveRequest(req: ProcurementRequest, approverId: string): ProcurementRequest {
  return { ...req, status: 'approved', approvedBy: approverId, approvedAt: new Date().toISOString() }
}
/** 狀態流轉：退回 */
export function rejectRequest(req: ProcurementRequest, approverId: string): ProcurementRequest {
  return { ...req, status: 'rejected', approvedBy: approverId, approvedAt: new Date().toISOString() }
}
/** 狀態流轉：標記完工（可附完工存證參照） */
export function completeRequest(req: ProcurementRequest, evidenceRef: string | null): ProcurementRequest {
  return {
    ...req, status: 'completed',
    completionEvidenceRef: evidenceRef ?? req.completionEvidenceRef,
    completedAt: new Date().toISOString(),
  }
}
