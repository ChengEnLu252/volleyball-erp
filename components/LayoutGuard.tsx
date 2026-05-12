'use client'

import { usePathname } from 'next/navigation'
import RequireRole from './RequireRole'
import { pathToPageKey } from '@/data/permissions'

/**
 * Layout-level page guard。
 *
 * 從 pathname 推 pageKey，命中權限矩陣的頁就套 RequireRole；
 * 公開頁（/captain/[token]、/book/[venue]、/login、/api、/）回 null
 * 則完全跳過守衛。
 *
 * 設計理由：
 *   避免在 19 個 page.tsx 各自手動包 RequireRole — 在 root layout 統一處理。
 *
 * 公開頁不在權限矩陣管轄：
 *   - /captain/[token]：主揪用 token 登入，不需要 User 帳號
 *   - /book/[venue]：客戶訂場頁，完全公開
 *   - /login、/api、/：登入頁 / API / 預設跳轉，無頁面實體
 */
export default function LayoutGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageKey = pathToPageKey(pathname)

  if (pageKey === null) {
    // 公開頁 — 不過權限
    return <>{children}</>
  }

  return <RequireRole page={pageKey}>{children}</RequireRole>
}
