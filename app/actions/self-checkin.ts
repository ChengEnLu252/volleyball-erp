'use server'

// ============================================================
// app/actions/self-checkin.ts — 無人場次客戶自助回報（server action）
// ------------------------------------------------------------
// P2.1c：客戶在無人場次按「我已付款」。
//   公開（無 user session / 無 token）：授權＝場次為無人場次 + 報名屬該場次。
//   只寫 Registration.selfReported*（**不建 Payment**）——「自助回報」≠「實收」，
//   需館長在後台「確認入帳」才會產生真 Payment（走 collectPaymentAction）。
//   保留樂觀鎖（比對 Registration.updatedAt）→ 衝突回 ConflictResult。
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ConflictResult, PaymentMethod } from '@/types'

type Ok = { ok: true }
type Err = { ok: false; reason: string }

const VALID_METHODS: PaymentMethod[] = ['cash', 'transfer', 'online']

export async function reportSelfPaymentAction(args: {
  sessionId: string
  registrationId: string
  method: PaymentMethod
  evidence?: string | null
  baseUpdatedAt?: string
}): Promise<Ok | Err | ConflictResult> {
  if (!VALID_METHODS.includes(args.method)) return { ok: false, reason: '付款方式無效' }

  const reg = await prisma.registration.findUnique({
    where: { id: args.registrationId },
    include: { session: { select: { id: true, isUnattended: true } } },
  })
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (reg.sessionId !== args.sessionId) return { ok: false, reason: '報名與場次不符' }
  if (reg.status === 'cancelled') return { ok: false, reason: '此報名已請假，無需付款' }
  if (reg.type === 'season_player') return { ok: false, reason: '季打人員無需另外付款' }
  if (reg.selfReportedPaid) return { ok: false, reason: '已回報過' }
  if (!reg.session.isUnattended) return { ok: false, reason: '此場非無人場次' }

  // 樂觀鎖：比對 updatedAt（雙開分頁、館長同步補入帳等場景）
  const current = reg.updatedAt.toISOString()
  if (args.baseUpdatedAt && args.baseUpdatedAt !== current) {
    return { ok: false, conflict: true, reason: '此名單在你操作前已被他人更新', currentUpdatedAt: current, lastEditedBy: null }
  }

  await prisma.registration.update({
    where: { id: args.registrationId },
    data: {
      selfReportedPaid: true,
      selfPaymentMethod: args.method,
      selfPaymentEvidence: args.evidence?.trim() || null,
      selfReportedAt: new Date(),
    },
  })
  await prisma.auditLog.create({
    data: {
      userId: null, action: 'SELF_PAYMENT_REPORT',
      entityType: 'Registration', entityId: args.registrationId,
      newValues: { selfReportedPaid: true, selfPaymentMethod: args.method, selfPaymentEvidence: args.evidence ?? null },
    },
  })

  revalidatePath(`/self-checkin/${args.sessionId}`)
  return { ok: true }
}
