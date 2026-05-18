'use client'

// ============================================================
// components/ChromeShell.tsx
// ============================================================
// 階段 12 新增 → 階段 14 改：
//   - 加上 LoginGate（未登入時整個 ERP 被 LoginCard 蓋住）
//   - 拿掉 ImpersonationBanner（已改成真實切帳號，無「視角」概念）
//
// /book/* 與 /captain/* 等公開頁完全跳過 ERP chrome（含登入閘門）。
// ============================================================

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import LayoutGuard from './LayoutGuard'
import LoginGate from './LoginGate'

export default function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBookingSite = pathname.startsWith('/book/') || pathname === '/book'
  const isCaptainSite = pathname.startsWith('/captain/') || pathname === '/captain'

  if (isBookingSite || isCaptainSite) {
    // 公開頁 — 完全獨立，無 ERP chrome、無登入閘門
    return <>{children}</>
  }

  // ERP — 登入閘門 → 既有 sidebar + guard 結構
  return (
    <LoginGate>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <LayoutGuard>{children}</LayoutGuard>
        </main>
      </div>
    </LoginGate>
  )
}
