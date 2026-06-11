'use client'

// 階段 21 M2：收款對帳（合併 場次 / 季租單 / 商品 / 無人場次 / 誠實商店）
import { ReconTabs } from '@/components/reconciliation/ReconTabs'
import SessionReconciliationPage from '@/app/reconciliation/sessions/page'
import SeasonRentalReconciliationPage from '@/app/reconciliation/season-rentals/page'
import ProductReconciliationPage from '@/app/reconciliation/products/page'
import UnattendedReconciliationPage from '@/app/reconciliation/unattended/page'
import HonestShopReconciliationPage from '@/app/reconciliation/honest-shop/page'

export default function CollectionsReconciliationPage() {
  return (
    <ReconTabs
      groupTitle="收款對帳"
      tabs={[
        { key: 'sessions',     label: '場次',     icon: '📅', render: () => <SessionReconciliationPage /> },
        { key: 'rentals',      label: '季租單',   icon: '🎫', render: () => <SeasonRentalReconciliationPage /> },
        { key: 'products',     label: '商品',     icon: '📦', render: () => <ProductReconciliationPage /> },
        { key: 'unattended',   label: '無人場次', icon: '🚪', render: () => <UnattendedReconciliationPage /> },
        { key: 'honest-shop',  label: '誠實商店', icon: '💰', render: () => <HonestShopReconciliationPage /> },
      ]}
    />
  )
}
