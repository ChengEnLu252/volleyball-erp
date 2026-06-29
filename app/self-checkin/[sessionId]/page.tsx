// 無人場次自助回報 — server 殼（公開，無登入）：依 sessionId 查 DB（僅無人場次），
// 把資料傳給 SelfCheckinClient。回報走 reportSelfPaymentAction（只寫 selfReported，不建 Payment）。
import { getSelfCheckinDataAsync } from '@/data/server/queries'
import SelfCheckinClient from './SelfCheckinClient'

export const dynamic = 'force-dynamic'

export default async function SelfCheckinPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const data = await getSelfCheckinDataAsync(sessionId)
  return <SelfCheckinClient data={data} />
}
