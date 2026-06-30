'use server'

// ============================================================
// app/actions/manager-salary.ts — 管理職薪資（P2.3b，server actions）
// ------------------------------------------------------------
// 管理職薪資從 localStorage 改成寫進 Supabase manager_salaries（一人一月一筆）。
//   授權：owner / manager + venue scope（工讀生唯讀）。
//   儲存：批次 upsert by id（client 提供 id）+ AuditLog。
//   結算（冷門場次獎金/分潤、年終、請假扣薪）由 payroll-core 注入「系統推導值」即時算。
//   系統推導值由 getManagerSysInputsAsync / getAnnualVenueRevenueAsync 查真 DB。
// ============================================================

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, getVenuesForUserAsync,
  getManagerSalariesRawAsync, getManagerSysInputsAsync, getAnnualVenueRevenueAsync,
  type UserScope,
} from '@/data/server/queries'
import { computeYearEndBonusCore, type ManagerSysInputs, type YearEndBonusResult } from '@/data/payroll-core'
import type { ManagerSalaryRecord, ManagerLineItem } from '@/types'

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
function currentMonth(): string { return new Date().toISOString().slice(0, 7) }
function resolveSel(venues: { id: string }[], venueId?: string, ym?: string) {
  const vid = venues.find((v) => v.id === venueId)?.id ?? venues[0]?.id ?? ''
  const m = /^\d{4}-\d{2}$/.test(ym ?? '') ? ym! : currentMonth()
  return { vid, m }
}
const int = (n: unknown): number => { const v = Math.round(Number(n)); return Number.isFinite(v) ? v : 0 }
const str = (s: unknown): string => (typeof s === 'string' ? s : '')

function cleanLines(raw: unknown): ManagerLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((li: any, i): ManagerLineItem => ({ id: str(li?.id) || `li-${i}`, label: str(li?.label), amount: int(li?.amount) }))
}

// ── 載入 ───────────────────────────────────────────────────────
export type ManagerBundle = {
  ok: true
  venues: { id: string; name: string }[]
  venueId: string
  month: string
  canEdit: boolean
  records: ManagerSalaryRecord[]
  sys: ManagerSysInputs
  yearEnd: YearEndBonusResult
  userId: string
} | { ok: false }

export async function loadManagerSalariesAction(args: { venueId?: string; month?: string }): Promise<ManagerBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }

  const venues = (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  const { vid, m } = resolveSel(venues, args.venueId, args.month)
  const canEdit = scope.role === 'owner' || scope.role === 'manager'
  const year = Number(m.slice(0, 4))

  if (!vid) {
    return { ok: true, venues, venueId: '', month: m, canEdit, records: [],
      sys: { offPeakOpenedCount: 0, offPeakCourtRevenue: 0, hotStatus: { total: 0, opened: 0, fullyOpen: false }, monthlyRevenue: 0, floor: 0 },
      yearEnd: computeYearEndBonusCore('', year, 0), userId: scope.userId }
  }
  const [records, sys, annual] = await Promise.all([
    getManagerSalariesRawAsync(scope, vid, m),
    getManagerSysInputsAsync(vid, m),
    getAnnualVenueRevenueAsync(vid, year),
  ])
  return { ok: true, venues, venueId: vid, month: m, canEdit, records, sys, yearEnd: computeYearEndBonusCore(vid, year, annual), userId: scope.userId }
}

// ── 儲存（批次 upsert）─────────────────────────────────────────
export interface SaveManagerRecord {
  id: string
  personName: string
  baseSalary: number
  designPay: number
  bonuses: ManagerLineItem[]
  includeOffPeakBonus: boolean
  insuranceSelf: number
  leaveDays: number
  deductions: ManagerLineItem[]
}

export async function saveManagerSalariesAction(input: { venueId: string; month: string; records: SaveManagerRecord[] }): Promise<{ ok: true } | Err> {
  const scope = await requireEditorScope()
  if (!scope) return { ok: false, reason: '無權限編輯（限館長／老闆）' }
  if (!venueAllowed(scope, input.venueId)) return { ok: false, reason: '不可編輯其他球館' }
  if (!/^\d{4}-\d{2}$/.test(input.month)) return { ok: false, reason: '月份格式錯誤' }

  for (const r of input.records) {
    if (!r.id) continue
    const data = {
      venueId: input.venueId, month: input.month,
      personName: str(r.personName),
      baseSalary: int(r.baseSalary), designPay: int(r.designPay),
      bonuses: cleanLines(r.bonuses) as unknown as Prisma.InputJsonValue,
      includeOffPeakBonus: !!r.includeOffPeakBonus,
      insuranceSelf: int(r.insuranceSelf), leaveDays: int(r.leaveDays),
      deductions: cleanLines(r.deductions) as unknown as Prisma.InputJsonValue,
      updatedBy: scope.userId,
    }
    await prisma.managerSalary.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data })
  }

  await prisma.auditLog.create({
    data: {
      userId: scope.userId, action: 'UPSERT_LEDGER',
      entityType: 'ManagerSalary', entityId: `${input.venueId}:${input.month}`,
      newValues: { venueId: input.venueId, month: input.month, recordCount: input.records.length },
    },
  })

  revalidatePath('/reconciliation/payroll/manager')
  revalidatePath('/reconciliation/staff-pay')
  return { ok: true }
}
