'use server'

// ============================================================
// app/actions/payroll.ts — 工讀生時薪表（P2.3a，server actions）
// ------------------------------------------------------------
// 工讀生薪資表從 localStorage 改成寫進 Supabase part_timer_sheets（一館一月一張）。
//   授權：owner / manager，且該 venue 在可見範圍（工讀生唯讀）。
//   寫入：upsert by (venueId, month) + AuditLog(UPSERT_LEDGER 借用：記帳/薪資皆為對帳輸入)。
//   計算（正常薪水/薪資比例）由 data/payroll-core 即時算、不存。
//   系統營收（薪資比例分母）由 getMonthlyVenueRevenueAsync 查真 DB。
// ============================================================

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, getVenuesForUserAsync, getPartTimerSheetRawAsync, getMonthlyVenueRevenueAsync,
  type UserScope,
} from '@/data/server/queries'
import type { PartTimerRow, PartTimerPayrollSheet } from '@/types'

type Err = { ok: false; reason: string }

async function requireEditorScope(): Promise<UserScope | null> {
  const me = await getSessionUser()
  if (!me) return null
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return null
  return scope
}

function venueAllowed(scope: UserScope, venueId: string): boolean {
  return scope.visibleVenueIds === 'all' || scope.visibleVenueIds.includes(venueId)
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function resolveSel(venues: { id: string }[], venueId?: string, ym?: string) {
  const vid = venues.find((v) => v.id === venueId)?.id ?? venues[0]?.id ?? ''
  const m = /^\d{4}-\d{2}$/.test(ym ?? '') ? ym! : currentMonth()
  return { vid, m }
}

const int = (n: unknown): number => { const v = Math.round(Number(n)); return Number.isFinite(v) ? v : 0 }
const str = (s: unknown): string => (typeof s === 'string' ? s : '')

/** 清洗 rows：保留結構、數字欄轉整數、字串欄轉字串 */
function cleanRows(raw: unknown): PartTimerRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r: any, i): PartTimerRow => ({
    id: str(r?.id) || `row-${i}`,
    name: str(r?.name),
    level: (typeof r?.level === 'string' ? r.level : 'helper') as PartTimerRow['level'],
    hourlyRate: int(r?.hourlyRate),
    normalHours: int(r?.normalHours),
    bonus: int(r?.bonus),
    penalty: int(r?.penalty),
    note: str(r?.note),
  }))
}

// ── 載入（client 自取）─────────────────────────────────────────
export type PartTimerBundle = {
  ok: true
  venues: { id: string; name: string }[]
  venueId: string
  month: string
  canEdit: boolean
  sheet: PartTimerPayrollSheet
  systemRevenue: number
  userId: string
} | { ok: false }

export async function loadPartTimerSheetAction(args: { venueId?: string; month?: string }): Promise<PartTimerBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }

  const venues = (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  const { vid, m } = resolveSel(venues, args.venueId, args.month)
  const canEdit = scope.role === 'owner' || scope.role === 'manager'
  const [sheet, systemRevenue] = vid
    ? await Promise.all([getPartTimerSheetRawAsync(scope, vid, m), getMonthlyVenueRevenueAsync(vid, m)])
    : [{ venueId: '', month: m, rows: [], revenueOverride: null, updatedBy: '', updatedAt: '' } as PartTimerPayrollSheet, 0]
  return { ok: true, venues, venueId: vid, month: m, canEdit, sheet, systemRevenue, userId: scope.userId }
}

// ── 儲存 ───────────────────────────────────────────────────────
export interface SavePartTimerInput {
  venueId: string
  month: string
  rows: PartTimerRow[]
  revenueOverride: number | null
}

export async function savePartTimerSheetAction(input: SavePartTimerInput): Promise<{ ok: true } | Err> {
  const scope = await requireEditorScope()
  if (!scope) return { ok: false, reason: '無權限編輯（限館長／老闆）' }
  if (!venueAllowed(scope, input.venueId)) return { ok: false, reason: '不可編輯其他球館' }
  if (!/^\d{4}-\d{2}$/.test(input.month)) return { ok: false, reason: '月份格式錯誤' }

  const rows = cleanRows(input.rows)
  const revenueOverride = input.revenueOverride == null ? null : int(input.revenueOverride)
  const data = {
    rows: rows as unknown as Prisma.InputJsonValue,
    revenueOverride,
    updatedBy: scope.userId,
  }

  const saved = await prisma.partTimerSheet.upsert({
    where: { venueId_month: { venueId: input.venueId, month: input.month } },
    create: { venueId: input.venueId, month: input.month, ...data },
    update: data,
  })

  await prisma.auditLog.create({
    data: {
      userId: scope.userId, action: 'UPSERT_LEDGER',
      entityType: 'PartTimerSheet', entityId: saved.id,
      newValues: { venueId: input.venueId, month: input.month, rowCount: rows.length },
    },
  })

  revalidatePath('/reconciliation/payroll')
  revalidatePath('/reconciliation/staff-pay')
  return { ok: true }
}
