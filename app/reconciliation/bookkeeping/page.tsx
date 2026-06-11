'use client'

// 階段 21 M2：記帳對帳（合併 月記帳輸入 / 月記帳對帳 / 月結）
import { ReconTabs } from '@/components/reconciliation/ReconTabs'
import LedgerInputPage from '@/app/reconciliation/ledger/page'
import LedgerReviewPage from '@/app/reconciliation/ledger/review/page'
import MonthlyReconciliationPage from '@/app/reconciliation/monthly/page'

export default function BookkeepingReconciliationPage() {
  return (
    <ReconTabs
      groupTitle="記帳對帳"
      tabs={[
        { key: 'ledger',  label: '月記帳輸入', icon: '📒', render: () => <LedgerInputPage /> },
        { key: 'review',  label: '月記帳對帳', icon: '🔎', render: () => <LedgerReviewPage /> },
        { key: 'monthly', label: '月結對帳',   icon: '📊', render: () => <MonthlyReconciliationPage /> },
      ]}
    />
  )
}
