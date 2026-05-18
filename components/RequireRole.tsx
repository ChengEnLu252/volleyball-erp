'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCurrentUser, getEffectiveRole, getPageAccess,
  logout as apiLogout,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import { EFFECTIVE_ROLE_LABEL, PAGE_LABEL, type PageKey } from '@/data/permissions'

interface RequireRoleProps {
  /** 此 page 在權限矩陣的 key */
  page: PageKey
  /** Page 內容 — access 通過時 render */
  children: React.ReactNode
}

/**
 * Page-level 權限守衛。
 *
 * 用法：每個受保護的 page 最外層包一層：
 *   export default function FinancePage() {
 *     return (
 *       <RequireRole page="finance">
 *         <FinancePageInner />
 *       </RequireRole>
 *     )
 *   }
 *
 * SSR 階段：先 render 一個極簡 placeholder（避免水合不一致），
 * client mount 後 hydrate store + 重新 evaluate access。
 *
 * 注意：因 store 是 client-only，SSR 的權限判斷沒意義 —
 * 真正的擋人發生在 client mount 後第一次 render。
 */
export default function RequireRole({ page, children }: RequireRoleProps) {
  const router = useRouter()

  // 訂閱 store 變更（切視角立即 re-evaluate）
  useStoreSync()

  // SSR / 首次 client render：保守先擋著，避免閃出受保護內容
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  if (!mounted) {
    // 簡單骨架 — 避免 SSR 跟 client 不一致
    return (
      <div style={{ padding: 40, color: '#7a7568', fontSize: 14 }}>
        載入中…
      </div>
    )
  }

  const user = getCurrentUser()
  if (!user) {
    // 理論上 demo 永遠有 currentUser，但保底處理
    return <DeniedCard page={page} reason="尚未登入" onSessions={() => router.push('/sessions')} />
  }

  const access = getPageAccess(user.id, page)
  if (access === 'denied') {
    return <DeniedCard page={page} reason={composeReason(user.id)} onSessions={() => router.push('/sessions')} />
  }

  return <>{children}</>
}


// ============================================================
// 403 卡片
// ============================================================

function composeReason(userId: string): string {
  const role = getEffectiveRole(userId)
  const label = EFFECTIVE_ROLE_LABEL[role]
  return `您目前的角色「${label}」沒有此頁的權限。`
}

interface DeniedCardProps {
  page: PageKey
  reason: string
  onSessions: () => void
}

function DeniedCard({ page, reason, onSessions }: DeniedCardProps) {
  const user = getCurrentUser()
  const role = user ? getEffectiveRole(user.id) : 'none'

  const onLogoutClick = () => {
    apiLogout()
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 80px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#fff8ec',
          border: '1px solid #d4a843',
          borderRadius: 12,
          padding: '32px 36px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#5c4a1a', margin: '0 0 8px 0' }}>
          無權限存取
        </h2>
        <div style={{ fontSize: 13, color: '#7a6a3a', marginBottom: 6 }}>
          頁面：<strong>{PAGE_LABEL[page]}</strong>
        </div>
        <div style={{ fontSize: 13, color: '#7a6a3a', marginBottom: 24 }}>
          {reason}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(role === 'staff' || role === 'manager') && (
            <button
              onClick={onSessions}
              style={{
                background: '#5c4a1a',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              回到場次管理
            </button>
          )}

          <button
            onClick={onLogoutClick}
            style={{
              background: '#fff',
              color: '#5c4a1a',
              border: '1px solid #d4a843',
              padding: '10px 16px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↩ 登出，切換其他帳號
          </button>
        </div>
      </div>
    </div>
  )
}
