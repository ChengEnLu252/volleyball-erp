'use server'

// ============================================================
// app/actions/goals.ts — 館長週目標工作流（P2.3c，server actions）
// ------------------------------------------------------------
// 工作流：建立(assigned) →（館長上傳截圖）submit → 老闆 confirm / return。
//   每步落 DB（weekly_goals）+ 發通知（app_notifications）+ AuditLog。
//   截圖實體存物件儲存留 P4；此處只記 evidenceId 引用（沿用既有上傳機制）。
//
// 授權：
//   建立  — owner（owner_assigned）或 manager（manager_self），venue 在 scope。
//   提交  — manager，且該 goal 的 venue 在 scope；assigned/returned → submitted。
//   確認/退回 — owner；submitted → confirmed/returned。
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, getVenuesForUserAsync, getWeeklyGoalsForUserAsync,
  type UserScope,
} from '@/data/server/queries'
import type { WeeklyGoal } from '@/types'

type Err = { ok: false; reason: string }

function venueAllowed(scope: UserScope, venueId: string): boolean {
  return scope.visibleVenueIds === 'all' || scope.visibleVenueIds.includes(venueId)
}

/** YYYY-MM-DD → 該週週一（ISO date） */
function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=日..6=六
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return d.toISOString().slice(0, 10)
}
function currentWeekStart(): string {
  return weekStartOf(new Date().toISOString().slice(0, 10))
}

async function listVenueManagerIds(venueId: string): Promise<string[]> {
  const rows = await prisma.userVenueRole.findMany({ where: { venueId, role: 'manager' }, select: { userId: true } })
  return [...new Set(rows.map((r) => r.userId))]
}
async function listOwnerIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { globalRole: 'owner', isActive: true }, select: { id: true } })
  return rows.map((r) => r.id)
}
async function venueName(venueId: string): Promise<string | null> {
  return (await prisma.venue.findUnique({ where: { id: venueId }, select: { name: true } }))?.name ?? null
}
async function userName(id: string): Promise<string> {
  return (await prisma.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? '館長'
}

async function notify(args: {
  type: 'goal_submitted' | 'goal_confirmed' | 'goal_returned'
  recipients: string[]
  title: string; body: string; relatedId: string
}) {
  if (args.recipients.length === 0) return
  await prisma.appNotification.createMany({
    data: args.recipients.map((recipientUserId) => ({
      type: args.type, recipientUserId, title: args.title, body: args.body,
      linkHref: '/goals', relatedType: 'WeeklyGoal', relatedId: args.relatedId,
    })),
  })
}

// ── 載入（client 自取）─────────────────────────────────────────
export type GoalsBundle = {
  ok: true
  role: 'owner' | 'manager' | 'staff' | 'none'
  venues: { id: string; name: string }[]
  goals: WeeklyGoal[]
  thisWeek: string
  userName: string
} | { ok: false }

export async function loadGoalsAction(): Promise<GoalsBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }
  const venues = (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  const goals = await getWeeklyGoalsForUserAsync(scope)
  return { ok: true, role: scope.role, venues, goals, thisWeek: currentWeekStart(), userName: me.name ?? '館長' }
}

// ── 建立 ───────────────────────────────────────────────────────
export async function createWeeklyGoalAction(args: { venueId: string; weekStart: string; description: string }): Promise<{ ok: true } | Err> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, reason: '無權限建立目標' }
  if (!venueAllowed(scope, args.venueId)) return { ok: false, reason: '不可指派其他球館' }
  const description = (args.description ?? '').trim()
  if (!description) return { ok: false, reason: '請輸入目標說明' }

  const source = scope.role === 'owner' ? 'owner_assigned' : 'manager_self'
  const goal = await prisma.weeklyGoal.create({
    data: { venueId: args.venueId, weekStart: new Date(weekStartOf(args.weekStart)), description, source, createdBy: scope.userId, status: 'assigned' },
  })
  await prisma.auditLog.create({ data: { userId: scope.userId, action: 'CREATE_WEEKLY_GOAL', entityType: 'WeeklyGoal', entityId: goal.id, newValues: { venueId: args.venueId, source } } })

  if (source === 'owner_assigned') {
    const vname = await venueName(args.venueId)
    await notify({ type: 'goal_submitted', recipients: await listVenueManagerIds(args.venueId), title: '新的週目標', body: `老闆指派了一個本週目標給 ${vname ?? '你的場館'}：${description.slice(0, 30)}`, relatedId: goal.id })
  }
  revalidatePath('/goals')
  return { ok: true }
}

// ── 提交（館長上傳截圖後）──────────────────────────────────────
export async function submitWeeklyGoalAction(args: { goalId: string; evidenceId: string }): Promise<{ ok: true } | Err> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false, reason: '無權限' }
  const goal = await prisma.weeklyGoal.findUnique({ where: { id: args.goalId } })
  if (!goal) return { ok: false, reason: '找不到此目標' }
  if (!venueAllowed(scope, goal.venueId)) return { ok: false, reason: '不可提交其他球館的目標' }
  if (goal.status === 'submitted') return { ok: false, reason: '此目標已提交，等待老闆確認' }
  if (goal.status === 'confirmed') return { ok: false, reason: '此目標已確認完成' }

  await prisma.weeklyGoal.update({ where: { id: goal.id }, data: { status: 'submitted', evidenceId: args.evidenceId, submittedBy: scope.userId, submittedAt: new Date(), returnReason: null } })
  await prisma.auditLog.create({ data: { userId: scope.userId, action: 'SUBMIT_WEEKLY_GOAL', entityType: 'WeeklyGoal', entityId: goal.id, newValues: { evidenceId: args.evidenceId, status: 'submitted' } } })

  const vname = await venueName(goal.venueId)
  const who = await userName(scope.userId)
  await notify({ type: 'goal_submitted', recipients: await listOwnerIds(), title: '館長目標待確認', body: `${vname ?? '某館'}的 ${who} 已上傳完成截圖：${goal.description.slice(0, 30)}`, relatedId: goal.id })
  revalidatePath('/goals')
  return { ok: true }
}

// ── 確認 ───────────────────────────────────────────────────────
export async function confirmWeeklyGoalAction(args: { goalId: string }): Promise<{ ok: true } | Err> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role !== 'owner') return { ok: false, reason: '只有老闆可確認' }
  const goal = await prisma.weeklyGoal.findUnique({ where: { id: args.goalId } })
  if (!goal) return { ok: false, reason: '找不到此目標' }
  if (goal.status !== 'submitted') return { ok: false, reason: '只有「待確認」的目標可以確認' }

  await prisma.weeklyGoal.update({ where: { id: goal.id }, data: { status: 'confirmed', confirmedBy: scope.userId, confirmedAt: new Date() } })
  await prisma.auditLog.create({ data: { userId: scope.userId, action: 'CONFIRM_WEEKLY_GOAL', entityType: 'WeeklyGoal', entityId: goal.id, newValues: { status: 'confirmed' } } })
  if (goal.submittedBy) {
    const vname = await venueName(goal.venueId)
    await notify({ type: 'goal_confirmed', recipients: [goal.submittedBy], title: '目標已確認', body: `老闆已確認你在 ${vname ?? '場館'} 的完成回報：${goal.description.slice(0, 30)}`, relatedId: goal.id })
  }
  revalidatePath('/goals')
  return { ok: true }
}

// ── 退回 ───────────────────────────────────────────────────────
export async function returnWeeklyGoalAction(args: { goalId: string; reason: string }): Promise<{ ok: true } | Err> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role !== 'owner') return { ok: false, reason: '只有老闆可退回' }
  const reason = (args.reason ?? '').trim()
  if (!reason) return { ok: false, reason: '請填寫退回理由' }
  const goal = await prisma.weeklyGoal.findUnique({ where: { id: args.goalId } })
  if (!goal) return { ok: false, reason: '找不到此目標' }
  if (goal.status !== 'submitted') return { ok: false, reason: '只有「待確認」的目標可以退回' }

  await prisma.weeklyGoal.update({ where: { id: goal.id }, data: { status: 'returned', returnReason: reason, confirmedBy: scope.userId } })
  await prisma.auditLog.create({ data: { userId: scope.userId, action: 'RETURN_WEEKLY_GOAL', entityType: 'WeeklyGoal', entityId: goal.id, newValues: { status: 'returned', returnReason: reason } } })
  if (goal.submittedBy) {
    const vname = await venueName(goal.venueId)
    await notify({ type: 'goal_returned', recipients: [goal.submittedBy], title: '目標被退回', body: `老闆退回了你在 ${vname ?? '場館'} 的回報，理由：${reason.slice(0, 40)}`, relatedId: goal.id })
  }
  revalidatePath('/goals')
  return { ok: true }
}
