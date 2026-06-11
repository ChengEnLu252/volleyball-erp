'use client'

// 階段 21 M2：規章罰則（合併 採購簽核 / 零用金 / 比賽企劃 / 報表追蹤）
import { ReconTabs } from '@/components/reconciliation/ReconTabs'
import ProcurementPage from '@/app/reconciliation/procurement/page'
import PettyCashPage from '@/app/reconciliation/petty-cash/page'
import CompetitionsPage from '@/app/reconciliation/competitions/page'
import ReportTrackingPage from '@/app/reconciliation/reports/page'

export default function CompliancePage() {
  return (
    <ReconTabs
      groupTitle="規章罰則"
      tabs={[
        { key: 'procurement',  label: '採購‧修繕簽核', icon: '🧾', render: () => <ProcurementPage /> },
        { key: 'petty-cash',   label: '零用金台帳',     icon: '🪙', render: () => <PettyCashPage /> },
        { key: 'competitions', label: '比賽企劃',       icon: '🏐', render: () => <CompetitionsPage /> },
        { key: 'reports',      label: '報表繳交追蹤',   icon: '🗂️', render: () => <ReportTrackingPage /> },
      ]}
    />
  )
}
