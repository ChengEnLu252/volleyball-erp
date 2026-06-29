'use server'

// ============================================================
// app/actions/refunds.ts — 退費鏈（server actions）P2.1d
// ------------------------------------------------------------
// 場次取消後，對「已付款且未決定退費」的報名處理：
//   issueRefundAction：開退款 → 建負額 Payment(status=refunded) + Registration.refundDecision='refunded'
//                      + AuditLog(ISSUE_REFUND)
//   waiveRefundAction：放棄退費 → 只標 Registration.refundDecision='waived' + AuditLog(WAIVE_REFUND)
//                      （不建任何 Payment / 不退錢）
// 授權：owner / manager，且場次所屬 venue 在可見範圍（財務動作，staff 不可）。
// 保留樂觀鎖（比對 Registration.updatedAt）→ 衝突回 ConflictResult。
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, type UserScope } from '@/data/server/queries'
import type { ConflictResult, PaymentMethod } from '@/types'

type Err = { ok: false; reason: string }
const VALID_METHODS: PaymentMethod[] = ['cash', 'transfer', 'online']

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

type LoadResult =
  | { ok: false; fail: Err | ConflictResult }
  | { ok: true; netPaid: number; sessionId: string }

/** 共用前置：取 reg + 驗證可退費狀態（已取消場次、未決定、netPaid>0、樂觀鎖）*/
async function loadRefundable(scope: UserScope, registrationId: string, baseUpdatedAt?: string): Promise<LoadResult> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      session: { select: { id: true, venueId: true, status: true } },
      payments: { select: { amount: true } },
    },
  })
  if (!reg) return { ok: false, fail: { ok: false, reason: '找不到此報名' } }
  if (!venueAllowed(scope, reg.session.venueId)) return { ok: false, fail: { ok: false, reason: '無權限操作他館退費' } }
  if (reg.session.status !== 'cancelled') return { ok: false, fail: { ok: false, reason: '此場次未取消，不需退費' } }
  if (reg.refundDecision) return { ok: false, fail: { ok: false, reason: '此筆退費已處理過' } }
  const netPaid = reg.payments.reduce((s, p) => s + p.amount, 0)
  if (netPaid <= 0) return { ok: false, fail: { ok: false, reason: '此報名無已付款，不需退費' } }
  const current = reg.updatedAt.toISOString()
  if (baseUpdatedAt && baseUpdatedAt !== current) {
    return { ok: false, fail: { ok: false, conflict: true, reason: '此筆在你操作前已被他人更新', currentUpdatedAt: current, lastEditedBy: null } }
  }
  return { ok: true, netPaid, sessionId: reg.session.id }
}

export async function issueRefundAction(args: {
  registrationId: string; amount: number; method: PaymentMethod; notes?: string | null; baseUpdatedAt?: string
}): Promise<{ ok: true; paymentId: string } | Err | ConflictResult> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }
  if (!VALID_METHODS.includes(args.method)) return { ok: false, reason: '退款方式無效' }

  const loaded = await loadRefundable(scope, args.registrationId, args.baseUpdatedAt)
  if (!loaded.ok) return loaded.fail
  const { netPaid, sessionId } = loaded

  const amount = Math.round(args.amount)
  if (amount <= 0) return { ok: false, reason: '退款金額必須大於 0' }
  if (amount > netPaid) return { ok: false, reason: `退款不可超過應退 $${netPaid}` }

  const paymentId = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        registrationId: args.registrationId, recordedBy: scope.userId,
        amount: -amount, method: args.method, status: 'refunded', notes: args.notes?.trim() || null,
      },
    })
    await tx.registration.update({ where: { id: args.registrationId }, data: { refundDecision: 'refunded' } })
    await tx.auditLog.create({
      data: {
        userId: scope.userId, action: 'ISSUE_REFUND', entityType: 'Registration', entityId: args.registrationId,
        newValues: { amount, method: args.method, notes: args.notes ?? null, paymentId: payment.id },
      },
    })
    return payment.id
  })

  revalidatePath('/finance/refunds')
  revalidatePath(`/sessions/${sessionId}`)
  return { ok: true, paymentId }
}

export async function waiveRefundAction(args: {
  registrationId: string; reason: string; baseUpdatedAt?: string
}): Promise<{ ok: true } | Err | ConflictResult> {
  const scope = await requireManagerScope()
  if (!scope) return { ok: false, reason: '需館長以上權限' }
  if (!args.reason?.trim()) return { ok: false, reason: '請填寫放棄退費的原因' }

  const loaded = await loadRefundable(scope, args.registrationId, args.baseUpdatedAt)
  if (!loaded.ok) return loaded.fail
  const { sessionId } = loaded

  await prisma.$transaction(async (tx) => {
    await tx.registration.update({ where: { id: args.registrationId }, data: { refundDecision: 'waived' } })
    await tx.auditLog.create({
      data: {
        userId: scope.userId, action: 'WAIVE_REFUND', entityType: 'Registration', entityId: args.registrationId,
        newValues: { reason: args.reason.trim() },
      },
    })
  })

  revalidatePath('/finance/refunds')
  revalidatePath(`/sessions/${sessionId}`)
  return { ok: true }
}
