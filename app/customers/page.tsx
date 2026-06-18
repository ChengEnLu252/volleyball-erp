// 客戶資料頁 — server 殼：依登入者角色於 server 端查 Supabase，把 scope 過的
// 客戶 + 統計當 initialData 傳給既有畫面（CustomersClient）。client 端不再碰 DB。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getCustomersPageData } from '@/data/server/queries'
import CustomersClient from './CustomersClient'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const data = scope ? await getCustomersPageData(scope) : { customers: [], stats: {} }
  return (
    <RequireRole page="customers">
      <CustomersClient customers={data.customers} stats={data.stats} />
    </RequireRole>
  )
}
