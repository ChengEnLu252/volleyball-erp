'use server'

// ============================================================
// app/actions/payments.ts — 收款 / 取消收款（server actions）
// ------------------------------------------------------------
// P2.1：把「收款 / 標記已付款」從記憶體 store 改成真的寫進 Supabase。
//   付款狀態 = 「該 Registration 有沒有一筆 status='paid' 的 Payment」。
//   收款   → 建一筆 Payment(status='paid', recordedBy=登入者) + AuditLog(ADD_PAYMENT)
//   取消收款 → 刪掉該 Registration 的 paid Payment + AuditLog(UPDATE_PAYMENT)
//
// 授權：必須是已登入的 ERP 人員（工讀生/館長/老闆皆可做收款），且場次所屬
//   venue 在使用者可見範圍內（manager/staff 不能收他館的款）。
//   Payment.recordedBy 為必填 FK → User，所以收款一定是「具名」操作。
//
// 應收金額 = courtFee + (acEnabled ? acFee : 0)；季打(season_player)為 0、不收款。
// 退費（負額 Payment）屬後續步驟（需 refundDecision 欄位 + ISSUE_REFUND enum），此檔不處理。
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, type UserScope } from '@/data/server/queries'
import type { PaymentMethod } from '@/types'

type Err = { ok: false; reason: string }

const VALID_METHODS: PaymentMethod[] = ['cash', 'transfer', 'online']

/** 解析登入者 scope；任何已登入 ERP 人員（role !== 'none'）皆可收款 */
async function requireStaffScope(): Promise<UserScope | null> {
  const me = await getSessionUser()
  if (!me) return null
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return null
  return scope
}

function venueAllowed(scope: UserScope, venueId: string): boolean {
  return scope.visibleVenueIds === 'all' || scope.visibleVenueIds.includes(venueId)
}

/** 收款：替某筆報名建立一筆已付款 Payment（金額 = 該場應收，季打不適用）*/
export async function collectPaymentAction(args: {
  registrationId: string
  method: PaymentMethod
  notes?: string | null
}): Promise<{ ok: true; paymentId: string; amount: number } | Err> {
  const scope = await requireStaffScope()
  if (!scope) return { ok: false, reason: '請先登入' }
  if (!VALID_METHODS.includes(args.method)) return { ok: false, reason: '付款方式無效' }

  const reg = await prisma.registration.findUnique({
    where: { id: args.registrationId },
    include: {
      session: { select: { id: true, venueId: true, status: true, courtFee: true, acFee: true, acEnabled: true } },
      payments: { select: { id: true, amount: true, status: true } },
    },
  })
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (!venueAllowed(scope, reg.session.venueId)) return { ok: false, reason: '無權限收取他館款項' }
  if (reg.status === 'cancelled') return { ok: false, reason: '此報名已取消（請假），無需收款' }
  if (reg.session.status === 'cancelled') return { ok: false, reason: '此場次已取消，請改走退費流程' }
  if (reg.type === 'season_player') return { ok: false, reason: '季打人員季初已繳費，無需收款' }

  const amount = reg.session.courtFee + (reg.session.acEnabled ? reg.session.acFee : 0)
  if (amount <= 0) return { ok: false, reason: '此場次應收為 0，無需收款' }

  // 原子操作：在 transaction 內 check-then-create，避免雙擊建出兩筆已付款
  try {
    const paymentId = await prisma.$transaction(async (tx) => {
      const existingPaid = await tx.payment.findFirst({
        where: { registrationId: args.registrationId, status: 'paid' },
        select: { id: true },
      })
      if (existingPaid) throw new Error('ALREADY_PAID')

      const payment = await tx.payment.create({
        data: {
          registrationId: args.registrationId,
          recordedBy: scope.userId,
          amount,
          method: args.method,
          status: 'paid',
          notes: args.notes?.trim() || null,
        },
      })
      await tx.auditLog.create({
        data: {
          userId: scope.userId, action: 'ADD_PAYMENT',
          entityType: 'Payment', entityId: payment.id,
          newValues: { registrationId: args.registrationId, amount, method: args.method, status: 'paid' },
        },
      })
      return payment.id
    })

    revalidatePath(`/sessions/${reg.session.id}`)
    return { ok: true, paymentId, amount }
  } catch (e) {
    if (e instanceof Error && e.message === 'ALREADY_PAID') return { ok: false, reason: '此報名已收款，請勿重複收取' }
    throw e
  }
}

/** 取消收款：刪除該報名的已付款 Payment（誤收時用）。已有退費紀錄者不可取消 */
export async function undoPaymentAction(args: {
  registrationId: string
}): Promise<{ ok: true } | Err> {
  const scope = await requireStaffScope()
  if (!scope) return { ok: false, reason: '請先登入' }

  const reg = await prisma.registration.findUnique({
    where: { id: args.registrationId },
    include: {
      session: { select: { id: true, venueId: true } },
      payments: { select: { id: true, amount: true, status: true, method: true } },
    },
  })
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (!venueAllowed(scope, reg.session.venueId)) return { ok: false, reason: '無權限操作他館款項' }

  const paidPayments = reg.payments.filter((p) => p.status === 'paid')
  if (paidPayments.length === 0) return { ok: false, reason: '此報名尚未收款' }
  if (reg.payments.some((p) => p.status === 'refunded')) {
    return { ok: false, reason: '此報名已有退費紀錄，請至退費處理頁面，不可直接取消收款' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { registrationId: args.registrationId, status: 'paid' } })
    await tx.auditLog.create({
      data: {
        userId: scope.userId, action: 'UPDATE_PAYMENT',
        entityType: 'Registration', entityId: args.registrationId,
        oldValues: { status: 'paid', paymentIds: paidPayments.map((p) => p.id) },
        newValues: { status: 'unpaid', reason: '取消收款' },
      },
    })
  })

  revalidatePath(`/sessions/${reg.session.id}`)
  return { ok: true }
}
