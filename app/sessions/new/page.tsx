// 新增場次 — server 殼：依角色查可用球館 + 時段範本（Supabase）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getVenuesForUserAsync, getTimeslotsForUserAsync } from '@/data/server/queries'
import SessionNewClient from './SessionNewClient'

export const dynamic = 'force-dynamic'

export default async function NewSessionPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const [venues, timeslots] = scope
    ? await Promise.all([getVenuesForUserAsync(scope), getTimeslotsForUserAsync(scope)])
    : [[], []]

  return (
    <RequireRole page="sessions">
      <SessionNewClient
        venues={venues.map(v => ({ id: v.id, name: v.name }))}
        timeslots={timeslots}
        role={scope?.role ?? 'none'}
      />
    </RequireRole>
  )
}
