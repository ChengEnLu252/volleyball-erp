'use server'

// ============================================================
// app/actions/reminders.ts — 對可疑客戶發自助回報提醒（server action）
// ------------------------------------------------------------
// ⚠️ Placeholder：真正的「發送」屬 P2.5 通知管道（LINE/Email）。
//   目前只驗權限（owner/manager）並回 ok，尚未真正發送或寫 audit
//   （AuditAction enum 無對應值；待 P2.5 一併補 enum + 真發送）。
// ============================================================

import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope } from '@/data/server/queries'

export async function sendSelfReportReminderAction(_args: {
  customerId: string; message: string
}): Promise<{ ok: true; placeholder: true } | { ok: false; reason: string }> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '請先登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, reason: '需館長以上權限' }
  // TODO[P2.5]：接真實 LINE/Email 發送 + 寫 AuditLog（需補 AuditAction enum）
  return { ok: true, placeholder: true }
}
