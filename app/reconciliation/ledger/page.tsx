// 月記帳輸入 — server 殼：僅做 RequireRole + 把 ?venue=&ym= 當初值傳給 client。
// 資料由 client 透過 server action（loadLedgerInputAction）自取，避免 server-only 進 client bundle。
import RequireRole from '@/components/RequireRole'
import LedgerInputClient from './LedgerInputClient'

export const dynamic = 'force-dynamic'

export default async function LedgerInputPage({ searchParams }: { searchParams: Promise<{ venue?: string; ym?: string }> }) {
  const sp = await searchParams
  return (
    <RequireRole page="reconciliation">
      <LedgerInputClient initialVenue={sp.venue} initialYm={sp.ym} />
    </RequireRole>
  )
}
