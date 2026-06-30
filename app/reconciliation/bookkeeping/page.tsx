'use client'

// 階段 21 M2：記帳對帳（合併 月記帳輸入 / 月記帳對帳 / 月結）
import { ReconTabs } from '@/components/reconciliation/ReconTabs'
import LedgerInputClient from '@/app/reconciliation/ledger/LedgerInputClient'
import LedgerReviewClient from '@/app/reconciliation/ledger/review/LedgerReviewClient'
import MonthlyReconciliationPage from '@/app/reconciliation/monthly/page'

// 月記帳輸入/對帳已改走 DB（client 自取 server action）→ 此處直接嵌入 client，
// 不再 import 兩頁的 server 殼 page.tsx（會把 server-only 拖進 client bundle）。
export default function BookkeepingReconciliationPage() {
  return (
    <ReconTabs
      groupTitle="記帳對帳"
      tabs={[
        { key: 'ledger',  label: '月記帳輸入', icon: '📒', render: () => <LedgerInputClient /> },
        { key: 'review',  label: '月記帳對帳', icon: '🔎', render: () => <LedgerReviewClient /> },
        { key: 'monthly', label: '月結對帳',   icon: '📊', render: () => <MonthlyReconciliationPage /> },
      ]}
    />
  )
}
