// 異常清單 — server 殼：依 scope 由已遷 DB 資料產生異常（季租未付/場次少收/無人場次落差）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getReconciliationAnomaliesForUserAsync, getVenuesForUserAsync } from '@/data/server/queries'
import AnomaliesClient from './AnomaliesClient'

export const dynamic = 'force-dynamic'

export default async function AnomaliesPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const [anomalies, venues] = scope
    ? await Promise.all([getReconciliationAnomaliesForUserAsync(scope), getVenuesForUserAsync(scope)])
    : [[], []]

  return (
    <RequireRole page="reconciliation">
      <AnomaliesClient anomalies={anomalies} venues={venues.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))} />
    </RequireRole>
  )
}
