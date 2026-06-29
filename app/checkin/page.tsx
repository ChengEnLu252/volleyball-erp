// 前台報到 / 收款 — server 殼：依登入者角色查當日（或最近有場次的日子）可見館場次
// + 名單，傳給 CheckinClient。報到走 setAttendanceAction、收款走 collectPaymentAction。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getCheckinDataForUserAsync } from '@/data/server/queries'
import CheckinClient from './CheckinClient'

export const dynamic = 'force-dynamic'

export default async function CheckinPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const data = scope
    ? await getCheckinDataForUserAsync(scope)
    : { date: new Date().toISOString().split('T')[0], isToday: true, sessions: [] }

  return (
    <RequireRole page="checkin">
      <CheckinClient data={data} />
    </RequireRole>
  )
}
