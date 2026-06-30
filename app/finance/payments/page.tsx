// 報表匯出 — server 殼：依 scope 取可見球館，傳給 client（真 CSV 匯出走 server action）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getVenuesForUserAsync } from '@/data/server/queries'
import PaymentsExportClient from './PaymentsExportClient'

export const dynamic = 'force-dynamic'

export default async function ExportPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const venues = scope ? await getVenuesForUserAsync(scope) : []

  return (
    <RequireRole page="finance">
      <PaymentsExportClient venues={venues.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))} />
    </RequireRole>
  )
}
