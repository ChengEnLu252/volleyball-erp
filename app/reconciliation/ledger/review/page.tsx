// 月記帳對帳（老闆視角）— server 殼：僅做 RequireRole + 把 ?venue=&ym= 當初值傳給 client。
// 資料由 client 透過 server action（loadLedgerReviewAction）自取。
import RequireRole from '@/components/RequireRole'
import LedgerReviewClient from './LedgerReviewClient'

export const dynamic = 'force-dynamic'

export default async function LedgerReviewPage({ searchParams }: { searchParams: Promise<{ venue?: string; ym?: string }> }) {
  const sp = await searchParams
  return (
    <RequireRole page="reconciliation">
      <LedgerReviewClient initialVenue={sp.venue} initialYm={sp.ym} />
    </RequireRole>
  )
}
