// 場次對帳 — server 殼：依登入者 scope + 期間（searchParams.period）查 Supabase，
// 逐場算應收/實收/缺口。期間切換以 ?period= 重新 SSR；球館/只看少收於前端篩選。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope,
  getSessionReconciliationForUserAsync,
  getVenuesForUserAsync,
  type SessionReconFilter,
} from '@/data/server/queries'
import SessionReconClient from './SessionReconClient'

export const dynamic = 'force-dynamic'

const PERIODS = ['week', 'month', 'season', 'all'] as const
type Period = (typeof PERIODS)[number]

export default async function SessionReconciliationPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams
  const period: Period = (PERIODS as readonly string[]).includes(sp.period ?? '') ? (sp.period as Period) : 'week'

  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const [rows, venues] = scope
    ? await Promise.all([
        getSessionReconciliationForUserAsync(scope, { period } as SessionReconFilter),
        getVenuesForUserAsync(scope),
      ])
    : [[], []]

  return (
    <RequireRole page="reconciliation">
      <SessionReconClient rows={rows} venues={venues.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))} period={period} />
    </RequireRole>
  )
}
