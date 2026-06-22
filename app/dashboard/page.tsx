// 總覽 dashboard — server 殼：依登入者角色於 server 端忠實重現各項統計（Supabase）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getDashboardForUserAsync } from '@/data/server/queries'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const bundle = scope ? await getDashboardForUserAsync(scope) : null

  return (
    <RequireRole page="dashboard">
      <DashboardClient bundle={bundle} />
    </RequireRole>
  )
}
