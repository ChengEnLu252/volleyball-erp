// 月記帳 Excel 匯入 — server 殼：RequireRole 把關，內容由 client 自取 server action。
import RequireRole from '@/components/RequireRole'
import LedgerImportClient from './LedgerImportClient'

export const dynamic = 'force-dynamic'

export default function LedgerImportPage() {
  return (
    <RequireRole page="reconciliation">
      <LedgerImportClient />
    </RequireRole>
  )
}
