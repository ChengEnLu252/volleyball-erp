'use client'

// ============================================================
// components/ChromeShell.tsx
// ============================================================
// 階段 12 新增。
// 把 root layout 的「Sidebar + ImpersonationBanner + LayoutGuard」三件
// 包進這個 client component，並用 usePathname 判斷：
//   - /book/*  → 客戶端報名頁，回傳純 children (無 ERP chrome)
//   - 其他      → 套 ERP chrome（既有行為）
//
// 為什麼需要：報名頁要當作「獨立網站」，不顯示 ERP sidebar 與 impersonation
// banner，未來部署到子網域時連 ERP code 都不會載入；現階段 demo 共用同個
// Next.js app，因此用 pathname 在前端隔離視覺。
// ============================================================

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import ImpersonationBanner from './ImpersonationBanner'
import LayoutGuard from './LayoutGuard'

export default function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBookingSite = pathname.startsWith('/book/') || pathname === '/book'

  if (isBookingSite) {
    // 報名頁 — 完全獨立，無 ERP chrome
    return <>{children}</>
  }

  // ERP — 原本的 sidebar + banner + guard 結構
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <ImpersonationBanner />
        <LayoutGuard>{children}</LayoutGuard>
      </main>
    </div>
  )
}
