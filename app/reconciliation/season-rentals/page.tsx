// 季租單對帳 — server 殼：依登入者角色於 server 端查 Supabase。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getSeasonRentalReconciliationForUserAsync, getVenuesForUserAsync } from '@/data/server/queries'
import SeasonRentalsClient from './SeasonRentalsClient'

export const dynamic = 'force-dynamic'

export default async function SeasonRentalReconciliationPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null

  const [rentals, venues] = scope
    ? await Promise.all([
        getSeasonRentalReconciliationForUserAsync(scope),
        getVenuesForUserAsync(scope),
      ])
    : [[], []]

  return (
    <RequireRole page="reconciliation">
      <SeasonRentalsClient
        rentals={rentals}
        venues={venues.filter(v => v.isActive).map(v => ({ id: v.id, name: v.name }))}
      />
    </RequireRole>
  )
}
