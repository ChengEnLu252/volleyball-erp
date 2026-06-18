'use server'

// ============================================================
// app/actions/captain.ts — 主揪 portal 寫入（server actions）
// ------------------------------------------------------------
// 公開（無 user session）：授權＝有效未過期 token + 目標場次屬於該 rental
// 的範圍（同 timeslot + 該季日期區間），server 端 scope 死。
//   - captainMarkLeaveAction / captainUnmarkLeaveAction：請假切換，
//     保留樂觀鎖（比對 Registration.updatedAt）→ 衝突回 ConflictResult
//   - captainAddWalkInAction：加臨打／補位（只填姓名、每次新建 Customer）
// ============================================================

import { prisma } from '@/lib/prisma'
import type { ConflictResult } from '@/types'

type Ok = { ok: true }
type Err = { ok: false; reason: string }
type Result = Ok | Err | ConflictResult

/** 解析 token → rental（含季範圍）；過期或不存在回 null */
async function resolveRental(token: string) {
  const r = await prisma.seasonRental.findUnique({
    where: { accessToken: token },
    include: { season: { select: { startDate: true, endDate: true } } },
  })
  if (!r) return null
  if (r.accessTokenExpiresAt.getTime() < Date.now()) return null
  return r
}

/** 確認 session 屬於此 rental 的範圍（同 timeslot + 該季日期區間）*/
function sessionInRentalScope(
  rental: { timeslotId: string; season: { startDate: Date; endDate: Date } },
  session: { timeslotId: string | null; sessionDate: Date },
): boolean {
  return (
    session.timeslotId === rental.timeslotId &&
    session.sessionDate >= rental.season.startDate &&
    session.sessionDate <= rental.season.endDate
  )
}

async function setLeave(
  token: string,
  registrationId: string,
  baseUpdatedAt: string | undefined,
  target: 'cancelled' | 'registered',
): Promise<Result> {
  const rental = await resolveRental(token)
  if (!rental) return { ok: false, reason: '連結無效或已過期' }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { session: { select: { timeslotId: true, sessionDate: true } } },
  })
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (!sessionInRentalScope(rental, reg.session)) return { ok: false, reason: '無權限操作此報名' }

  if (target === 'cancelled' && reg.status === 'cancelled') return { ok: false, reason: '已是請假狀態' }
  if (target === 'registered' && reg.status !== 'cancelled') return { ok: false, reason: '不在請假狀態' }

  // 樂觀鎖：比對 updatedAt
  const current = reg.updatedAt.toISOString()
  if (baseUpdatedAt && baseUpdatedAt !== current) {
    return {
      ok: false, conflict: true,
      reason: '此名單在你操作前已被他人更新',
      currentUpdatedAt: current,
      lastEditedBy: null,
    }
  }

  await prisma.registration.update({ where: { id: registrationId }, data: { status: target } })
  await prisma.auditLog.create({
    data: {
      userId: null,
      action: target === 'cancelled' ? 'CANCEL_REGISTRATION' : 'CREATE_REGISTRATION',
      entityType: 'Registration', entityId: registrationId,
      oldValues: { status: reg.status }, newValues: { status: target, by: 'captain' },
    },
  })
  return { ok: true }
}

export async function captainMarkLeaveAction(args: {
  token: string; registrationId: string; baseUpdatedAt?: string
}): Promise<Result> {
  return setLeave(args.token, args.registrationId, args.baseUpdatedAt, 'cancelled')
}

export async function captainUnmarkLeaveAction(args: {
  token: string; registrationId: string; baseUpdatedAt?: string
}): Promise<Result> {
  return setLeave(args.token, args.registrationId, args.baseUpdatedAt, 'registered')
}

export async function captainAddWalkInAction(args: {
  token: string; sessionId: string; name: string; type?: 'walk_in' | 'season_substitute'
}): Promise<{ ok: true; registrationId: string } | Err> {
  const name = args.name?.trim() ?? ''
  if (!name) return { ok: false, reason: '姓名不可空白' }

  const rental = await resolveRental(args.token)
  if (!rental) return { ok: false, reason: '連結無效或已過期' }

  const session = await prisma.session.findUnique({
    where: { id: args.sessionId },
    select: { timeslotId: true, sessionDate: true, status: true },
  })
  if (!session) return { ok: false, reason: '找不到場次' }
  if (!sessionInRentalScope(rental, session)) return { ok: false, reason: '無權限操作此場次' }
  if (session.status === 'cancelled') return { ok: false, reason: '此場次已取消' }

  // 主揪加人：只填姓名、每次新建 Customer（不去重，避免誤合）
  const customer = await prisma.customer.create({ data: { name, notes: '主揪新增' } })
  const reg = await prisma.registration.create({
    data: {
      sessionId: args.sessionId, customerId: customer.id,
      type: args.type ?? 'walk_in', registeredBySource: 'captain', registeredBy: null,
      status: 'registered',
    },
  })
  await prisma.auditLog.create({
    data: {
      userId: null, action: 'ADD_WALKIN_BY_CAPTAIN',
      entityType: 'Registration', entityId: reg.id,
      newValues: { sessionId: args.sessionId, customerId: customer.id, type: args.type ?? 'walk_in' },
    },
  })
  return { ok: true, registrationId: reg.id }
}
