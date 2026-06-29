// 退費處理 — server 殼：依登入者 scope 查待退費 + 退費歷史 + 可見館（供歷史篩選）。
// 退款/放棄退費走 server action（issueRefundAction / waiveRefundAction）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope,
  getPendingRefundsForUserAsync,
  getRefundHistoryForUserAsync,
  getVenuesForUserAsync,
} from '@/data/server/queries'
import RefundsClient from './RefundsClient'

export const dynamic = 'force-dynamic'

export default async function RefundsPage() {
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const [pending, history, venues] = scope
    ? await Promise.all([
        getPendingRefundsForUserAsync(scope),
        getRefundHistoryForUserAsync(scope),
        getVenuesForUserAsync(scope),
      ])
    : [[], [], []]

  return (
    <RequireRole page="finance/refunds">
      <RefundsClient pending={pending} history={history} venues={venues.map((v) => ({ id: v.id, name: v.name }))} />
    </RequireRole>
  )
}
