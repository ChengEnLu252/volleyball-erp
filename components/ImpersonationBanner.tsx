'use client'

import { useEffect, useState } from 'react'
import {
  getCurrentUser, getRealUser, getUserRoleLabel,
  isImpersonating, returnToRealUser,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'

/**
 * 切視角橫幅 — owner 切到非自身視角時頂部顯示。
 *
 * Demo 期望：陳老闆（u1，REAL_USER_ID）在 Sidebar dropdown 切到工讀生時，
 * 頁面上方出現「您正以 工讀生 · 飛翼 視角檢視 · [回到 owner]」
 *
 * SSR 階段不 render（避免水合不一致）。
 */
export default function ImpersonationBanner() {
  useStoreSync()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  if (!mounted) return null
  if (!isImpersonating()) return null

  const current = getCurrentUser()
  const real    = getRealUser()
  if (!current || !real) return null

  const currentLabel = getUserRoleLabel(current.id)

  const onReturn = () => {
    returnToRealUser()
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#fff4d6',
        borderBottom: '1px solid #d4a843',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        fontSize: 13,
        color: '#5c4a1a',
      }}
      data-testid="impersonation-banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎭</span>
        <span>
          您正以 <strong>{current.name}</strong>（{currentLabel}）視角檢視
          ·&nbsp;
          <span style={{ opacity: 0.7 }}>真實身份：{real.name}</span>
        </span>
      </div>
      <button
        onClick={onReturn}
        style={{
          background: '#5c4a1a',
          color: '#fff',
          border: 'none',
          padding: '4px 12px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        ⬆ 回到 owner 視角
      </button>
    </div>
  )
}
