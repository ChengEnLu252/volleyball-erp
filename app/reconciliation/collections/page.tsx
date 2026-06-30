'use client'

// 階段 21 M2：收款對帳（合併 場次 / 季租單 / 商品 / 無人場次 / 誠實商店）
import { ReconTabs } from '@/components/reconciliation/ReconTabs'
// 場次分頁直接用 client 元件（store-mode）；標準路由 /reconciliation/sessions 才走 server 殼
import SessionReconciliationPage from '@/app/reconciliation/sessions/SessionReconClient'
// 季租單分頁直接用 client 元件（store-mode）；標準路由 /reconciliation/season-rentals 才走 server 殼
import SeasonRentalReconciliationPage from '@/app/reconciliation/season-rentals/SeasonRentalsClient'
import ProductReconciliationPage from '@/app/reconciliation/products/page'
// 無人場次分頁直接用 client 元件（store-mode）；標準路由 /reconciliation/unattended 才走 server 殼
import UnattendedReconciliationPage from '@/app/reconciliation/unattended/UnattendedClient'
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
