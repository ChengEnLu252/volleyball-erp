// 帳號審核頁（owner）。server 端先驗 owner 再取待審清單 → 傳給 client。
// RequireRole 於前端再擋一次（雙重保險）；approveUser/rejectUser action 亦驗 owner。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { getPendingUsers } from '@/data/server/queries'
import ApprovalsClient from './ApprovalsClient'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const me = await getSessionUser()
  // 後端強制授權：非 owner 拿不到任何待審資料
  const pending = me?.globalRole === 'owner' ? await getPendingUsers() : []
  return (
    <RequireRole page="approvals">
      <ApprovalsClient initialPending={pending} />
    </RequireRole>
  )
}
