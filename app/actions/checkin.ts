'use server'

// ============================================================
// app/actions/checkin.ts — 前台報到（server action）
// ------------------------------------------------------------
// P2.1b：報到狀態（registered ↔ attended）改為真的寫進 Supabase。
// 授權＝已登入 ERP 人員（工讀生/館長/老闆）且場次屬可見館（同收款）。
// 收款本身走 app/actions/payments.ts 的 collectPaymentAction。
//
// 註：attendance 是低風險、高頻切換的動作，**不另寫 AuditLog**
//     （目前 AuditAction enum 只有 MARK_ATTENDANCE_BY_CAPTAIN；如日後需要
//      前台報到稽核，再加 MARK_ATTENDANCE enum + migration）。
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, type UserScope } from '@/data/server/queries'

type Err = { ok: false; reason: string }

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

/** 報到切換：registered ↔ attended */
export async function setAttendanceAction(args: {
  registrationId: string; attended: boolean
}): Promise<{ ok: true; status: 'attended' | 'registered' } | Err> {
  const scope = await requireStaffScope()
  if (!scope) return { ok: false, reason: '請先登入' }

  const reg = await prisma.registration.findUnique({
    where: { id: args.registrationId },
    include: { session: { select: { id: true, venueId: true } } },
  })
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (!venueAllowed(scope, reg.session.venueId)) return { ok: false, reason: '無權限操作他館場次' }
  if (reg.status === 'cancelled') return { ok: false, reason: '此報名已取消（請假）' }

  const next = args.attended ? 'attended' : 'registered'
  if (reg.status !== next) {
    await prisma.registration.update({ where: { id: args.registrationId }, data: { status: next } })
  }
  revalidatePath('/checkin')
  return { ok: true, status: next }
}
