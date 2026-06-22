// 場次管理（列表）— server 殼：依登入者角色於 server 端查近兩週場次（Supabase）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getSessionsForUserAsync, getVenuesForUserAsync } from '@/data/server/queries'
import SessionsClient from './SessionsClient'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null

  const today = new Date().toISOString().split('T')[0]
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [sessions, venues] = scope
    ? await Promise.all([
        getSessionsForUserAsync(scope, { dateFrom: today, dateTo: inTwoWeeks }),
        getVenuesForUserAsync(scope),
      ])
    : [[], []]

  const canCreate = scope?.role === 'owner' || scope?.role === 'manager'

  return (
    <RequireRole page="sessions">
      <SessionsClient
        sessions={sessions.filter(s => s.status !== 'cancelled')}
        venues={venues.map(v => ({ id: v.id, name: v.name }))}
        canCreate={!!canCreate}
      />
    </RequireRole>
  )
}
