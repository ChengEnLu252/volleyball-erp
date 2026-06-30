// 無人場次自助回報對照 — server 殼：依 scope 查 lookback 內無人場次 + 自助回報/實際入帳對照
// + 可疑客戶。資料傳給 UnattendedClient（dual-mode）。提醒走 sendSelfReportReminderAction（P2.5 placeholder）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getUnattendedReportForUserAsync } from '@/data/server/queries'
import UnattendedClient from './UnattendedClient'

export const dynamic = 'force-dynamic'

export default async function UnattendedReconciliationPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const bundle = scope ? await getUnattendedReportForUserAsync(scope) : null

  return (
    <RequireRole page="reconciliation">
      <UnattendedClient bundle={bundle ?? undefined} />
    </RequireRole>
  )
}
