'use server'

// ============================================================
// app/actions/sessions.ts — 場次寫入（server actions）
// ------------------------------------------------------------
// 授權：owner / manager，且場次所屬 venue 在使用者可見範圍（manager 不能動他館）。
//   - cancelSessionAction：取消場次（保留樂觀鎖 vs Session.updatedAt）
//   - patchSessionFeesAction：改費用（場地費/冷氣費/開冷氣）
//   - createCustomSessionAction / expandTimeslotToSessionsAction：建場次（9C）
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getBatchExpansionPreviewAsync, type UserScope, type BatchPreview } from '@/data/server/queries'
import type { ConflictResult, NetHeight, SessionType, SkillLevel } from '@/types'

type Err = { ok: false; reason: string }

// app SkillLevel(B+/A+/S*) → Prisma enum 名稱
const SKILL_TO_PRISMA: Record<string, string> = { 'B+': 'B_PLUS', 'A+': 'A_PLUS', 'S*': 'S_STAR' }
const toPrismaSkill = (s?: string | null): string | null => (s ? (SKILL_TO_PRISMA[s] ?? s) : null)

/** 解析登入者 scope，要求 owner/manager */
async function requireManagerScope(): Promise<UserScope | null> {
  const me = await getSessionUser()
  if (!me) return null
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return null
  return scope
}

function venueAllowed(scope: UserScope, venueId: string): boolean {
  return scope.visibleVenueIds === 'all' || scope.visibleVenueIds.includes(venueId)
}

export async function cancelSessionAction(args: {
  sessionId: string; reason: string; baseUpdatedAt?: string
}): Promise<{ ok: true; pendingRefundCount: number } | Err | ConflictResult> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }
  if (!args.reason?.trim()) return { ok: false, reason: '請填寫取消原因' }

  const s = await prisma.session.findUnique({ where: { id: args.sessionId } })
  if (!s) return { ok: false, reason: '找不到場次' }
  if (!venueAllowed(scope, s.venueId)) return { ok: false, reason: '無權限操作他館場次' }
  if (s.status !== 'open' && s.status !== 'full') return { ok: false, reason: '此場次狀態不可取消' }

  if (args.baseUpdatedAt && args.baseUpdatedAt !== s.updatedAt.toISOString()) {
    return { ok: false, conflict: true, reason: '此場次在你操作前已被他人更新', currentUpdatedAt: s.updatedAt.toISOString(), lastEditedBy: null }
  }

  await prisma.session.update({ where: { id: args.sessionId }, data: { status: 'cancelled' } })
  await prisma.auditLog.create({
    data: {
      userId: scope.userId, action: 'CANCEL_SESSION', entityType: 'Session', entityId: args.sessionId,
      oldValues: { status: s.status }, newValues: { status: 'cancelled', reason: args.reason.trim() },
    },
  })

  // 取消後需退費的筆數（已付款且非季打）
  const paid = await prisma.registration.count({
    where: { sessionId: args.sessionId, type: { not: 'season_player' }, payments: { some: { status: 'paid' } } },
  })

  revalidatePath(`/sessions/${args.sessionId}`)
  revalidatePath('/sessions')
  return { ok: true, pendingRefundCount: paid }
}

export async function patchSessionFeesAction(args: {
  sessionId: string; courtFee: number; acFee: number; acEnabled: boolean
}): Promise<{ ok: true } | Err> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }

  const s = await prisma.session.findUnique({ where: { id: args.sessionId } })
  if (!s) return { ok: false, reason: '找不到場次' }
  if (!venueAllowed(scope, s.venueId)) return { ok: false, reason: '無權限操作他館場次' }

  const courtFee = Math.max(0, Math.round(args.courtFee))
  const acFee = Math.max(0, Math.round(args.acFee))
  await prisma.session.update({
    where: { id: args.sessionId },
    data: { courtFee, acFee, acEnabled: args.acEnabled },
  })
  await prisma.auditLog.create({
    data: {
      userId: scope.userId, action: 'UPDATE_SESSION', entityType: 'Session', entityId: args.sessionId,
      oldValues: { courtFee: s.courtFee, acFee: s.acFee, acEnabled: s.acEnabled },
      newValues: { courtFee, acFee, acEnabled: args.acEnabled },
    },
  })
  revalidatePath(`/sessions/${args.sessionId}`)
  return { ok: true }
}

// ── 9C：新增場次 ─────────────────────────────────────────────

/** 批量預覽（client 在選範本/週數時呼叫）*/
export async function previewBatchExpansionAction(args: {
  timeslotId: string; fromDate: string; weeks: number
}): Promise<BatchPreview> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }
  return getBatchExpansionPreviewAsync(scope, args)
}

/** 範本批量展開建立場次 */
export async function expandTimeslotToSessionsAction(args: {
  timeslotId: string; fromDate: string; weeks: number; notes?: string | null
}): Promise<{ ok: true; createdSessionIds: string[]; skippedDates: string[] } | Err> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }

  const ts = await prisma.timeslot.findUnique({ where: { id: args.timeslotId } })
  if (!ts) return { ok: false, reason: '找不到此時段範本' }
  if (!venueAllowed(scope, ts.venueId)) return { ok: false, reason: '無權限操作他館範本' }

  const preview = await getBatchExpansionPreviewAsync(scope, { timeslotId: args.timeslotId, fromDate: args.fromDate, weeks: args.weeks })
  if (!preview.ok) return preview

  const toCreate = preview.dates.filter((d) => !d.skip)
  const skippedDates = preview.dates.filter((d) => d.skip).map((d) => d.date)
  const createdSessionIds = toCreate.map((d) => `s-${ts.id}-${d.date}`)

  if (toCreate.length > 0) {
    await prisma.session.createMany({
      data: toCreate.map((d) => ({
        id: `s-${ts.id}-${d.date}`,
        venueId: ts.venueId, timeslotId: ts.id, seasonRentalId: null, createdBy: scope.userId,
        sessionDate: new Date(d.date), startTime: ts.startTime, endTime: ts.endTime, court: ts.court,
        netHeight: ts.defaultNetHeight, sessionType: ts.defaultSessionType,
        courtFee: ts.defaultCourtFee, acFee: 0, acEnabled: false, maxCapacity: ts.defaultMaxCapacity,
        minSkillRequired: ts.defaultMinSkillRequired, maxSkillAllowed: ts.defaultMaxSkillAllowed,
        status: 'open', isUnattended: false, notes: args.notes ?? null,
      })),
      skipDuplicates: true,
    })
  }

  await prisma.auditLog.create({
    data: {
      userId: scope.userId, action: 'CREATE_SESSION', entityType: 'Timeslot', entityId: ts.id,
      newValues: { source: 'batch', timeslotId: ts.id, weeks: args.weeks, createdSessionIds, skippedDates },
    },
  })
  revalidatePath('/sessions')
  return { ok: true, createdSessionIds, skippedDates }
}

/** 單場手動建立 */
export async function createCustomSessionAction(args: {
  venueId: string; timeslotId?: string | null
  sessionDate: string; startTime: string; endTime: string; court?: string | null
  netHeight: NetHeight; sessionType: SessionType
  courtFee: number; acFee?: number; acEnabled?: boolean; maxCapacity: number
  minSkillRequired?: SkillLevel | null; maxSkillAllowed?: SkillLevel | null; notes?: string | null
}): Promise<{ ok: true; sessionId: string } | Err> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }
  if (!venueAllowed(scope, args.venueId)) return { ok: false, reason: '無權限替他館建立場次' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.sessionDate)) return { ok: false, reason: '日期格式錯誤' }
  if (!/^\d{2}:\d{2}$/.test(args.startTime) || !/^\d{2}:\d{2}$/.test(args.endTime)) return { ok: false, reason: '時間格式錯誤' }
  if (args.startTime >= args.endTime) return { ok: false, reason: '結束時間需晚於開始時間' }
  if (args.courtFee < 0) return { ok: false, reason: '球費不可為負' }
  if (args.maxCapacity <= 0) return { ok: false, reason: '容量上限需 > 0' }

  const venue = await prisma.venue.findUnique({ where: { id: args.venueId } })
  if (!venue) return { ok: false, reason: '找不到此球館' }

  const id = `s-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(16)}`
  await prisma.session.create({
    data: {
      id, venueId: args.venueId, timeslotId: args.timeslotId || null, seasonRentalId: null, createdBy: scope.userId,
      sessionDate: new Date(args.sessionDate), startTime: args.startTime, endTime: args.endTime, court: args.court?.trim() || null,
      netHeight: args.netHeight as never, sessionType: args.sessionType as never,
      courtFee: Math.round(args.courtFee), acFee: Math.round(args.acFee ?? 0), acEnabled: (args.acFee ?? 0) > 0 ? !!args.acEnabled : false,
      maxCapacity: args.maxCapacity,
      minSkillRequired: toPrismaSkill(args.minSkillRequired) as never, maxSkillAllowed: toPrismaSkill(args.maxSkillAllowed) as never,
      status: 'open', isUnattended: false, notes: args.notes?.trim() || null,
    },
  })
  await prisma.auditLog.create({
    data: { userId: scope.userId, action: 'CREATE_SESSION', entityType: 'Session', entityId: id, newValues: { source: 'manual', venueId: args.venueId, sessionDate: args.sessionDate } },
  })
  revalidatePath('/sessions')
  return { ok: true, sessionId: id }
}
