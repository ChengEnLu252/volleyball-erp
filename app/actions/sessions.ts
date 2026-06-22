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
import { resolveUserScope, type UserScope } from '@/data/server/queries'
import type { ConflictResult } from '@/types'

type Err = { ok: false; reason: string }

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
