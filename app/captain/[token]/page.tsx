// 主揪 portal — server 殼：依 token 於 server 端查 Supabase（授權 scope 死在查詢），
// 把完整資料包傳給 client 渲染。寫入走 app/actions/captain.ts。
import { getCaptainPortalByTokenAsync } from '@/data/server/queries'
import CaptainPortalClient from './CaptainPortalClient'

export const dynamic = 'force-dynamic'

export default async function CaptainPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const bundle = await getCaptainPortalByTokenAsync(token)
  return <CaptainPortalClient token={token} bundle={bundle} />
}
