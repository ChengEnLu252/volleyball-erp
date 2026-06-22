// 場次明細 — server 殼：依登入者角色查 Supabase（含名單 + 付款衍生）。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getSessionDetailForUserAsync } from '@/data/server/queries'
import SessionDetailClient from './SessionDetailClient'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const detail = scope ? await getSessionDetailForUserAsync(scope, id) : null

  return (
    <RequireRole page="sessions">
      <SessionDetailClient detail={detail} role={scope?.role ?? 'none'} currentUserName={me?.name ?? null} />
    </RequireRole>
  )
}
