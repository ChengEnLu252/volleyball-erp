'use client'

// 階段 21 M2：員工薪資（合併 工讀生時薪 / 管理職薪資）— 同時完成 Q4 整合骨架
import { ReconTabs } from '@/components/reconciliation/ReconTabs'
import PartTimerPayrollPage from '@/app/reconciliation/payroll/page'
import ManagerSalaryPage from '@/app/reconciliation/payroll/manager/page'

export default function StaffPayPage() {
  return (
    <ReconTabs
      groupTitle="員工薪資"
      tabs={[
        { key: 'parttime', label: '工讀生時薪', icon: '🧑‍💼', render: () => <PartTimerPayrollPage /> },
        { key: 'manager',  label: '管理職薪資', icon: '👔',     render: () => <ManagerSalaryPage /> },
      ]}
    />
  )
}
