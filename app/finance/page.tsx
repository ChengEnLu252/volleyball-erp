// 財務報表 — server 殼：依 scope + 期間（searchParams.period）由真 Payment 彙總收入/付款分佈/各館明細。
import RequireRole from '@/components/RequireRole'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getFinanceReportForUserAsync, type FinancePeriod } from '@/data/server/queries'
import FinanceClient from './FinanceClient'

export const dynamic = 'force-dynamic'

const PERIODS = ['today', 'week', 'month'] as const

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams
  const period: FinancePeriod = (PERIODS as readonly string[]).includes(sp.period ?? '') ? (sp.period as FinancePeriod) : 'week'

  const me = await getSessionUser()
  const scope = me ? await resolveUserScope(me.id) : null
  const report = scope ? await getFinanceReportForUserAsync(scope, period) : null

  return (
    <RequireRole page="finance">
      <FinanceClient report={report} />
    </RequireRole>
  )
}
