'use client'

// ============================================================
// components/LoginGate.tsx — 階段 14：登入閘門
// ============================================================
// 包在 ERP chrome 外層；未登入時整個畫面只顯示 LoginCard。
//
// 流程：
//   1. App 啟動 → hydrate store → 讀 isAuthenticated
//   2. false → 顯示 LoginCard（選 user + 輸密碼）
//   3. 密碼正確 → store 寫 isAuthenticated=true + currentUserId=該 user
//   4. 元件 re-render → 通過 → 顯示 children（ERP 主畫面）
//
// SSR 階段先給「載入中」骨架，避免 hydration mismatch。
// ============================================================

import { useEffect, useState } from 'react'
import { listAllUsers, login as apiLogin, isAuthenticated, getUserRoleLabel, getEffectiveRole } from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'

function roleColor(userId: string): string {
  const role = getEffectiveRole(userId)
  if (role === 'owner')   return '#d4a843'
  if (role === 'manager') return '#7fb8e8'
  if (role === 'staff')   return '#9ca3af'
  return '#666'
}

export default function LoginGate({ children }: { children: React.ReactNode }) {
  useStoreSync()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f5f4f0', color: '#7a7568', fontSize: 14,
      }}>
        載入中…
      </div>
    )
  }

  if (!isAuthenticated()) {
    return <LoginCard />
  }

  return <>{children}</>
}


// ============================================================
// LoginCard — 選 user + 輸密碼
// ============================================================

function LoginCard() {
  const users = listAllUsers()
  // 預設展開第一位（owner），讓 demo 開最快
  const [selectedId, setSelectedId] = useState<string>(users[0]?.id ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = () => {
    if (!selectedId) {
      setError('請選擇身份')
      return
    }
    if (!password) {
      setError('請輸入密碼')
      return
    }
    const ok = apiLogin(selectedId, password)
    if (!ok) {
      setError('密碼錯誤')
      setPassword('')
      return
    }
    // 成功：LoginGate 上層會 re-render
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: 'linear-gradient(135deg, #1a1917 0%, #2a2825 100%)',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#fff', borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1917' }}>🏐 VolleyOps</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>排球場館管理系統</div>
        </div>

        <div style={{ fontSize: 12, color: '#666', marginBottom: 10, fontWeight: 500 }}>
          請選擇身份
        </div>

        <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
          {users.map(u => {
            const active = selectedId === u.id
            const label = getUserRoleLabel(u.id)
            return (
              <button
                key={u.id}
                onClick={() => { setSelectedId(u.id); setError('') }}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: active ? '2px solid #1a1917' : '1px solid #e8e6e0',
                  borderRadius: 10,
                  background: active ? '#fafaf8' : '#fff',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1917' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: roleColor(u.id), marginTop: 2, fontWeight: 500 }}>{label}</div>
                </div>
                {active && <span style={{ color: '#1a1917', fontSize: 16 }}>✓</span>}
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 500 }}>
          密碼
        </div>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          placeholder="輸入 4 位數密碼"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            border: error ? '1px solid #dc2626' : '1px solid #e8e6e0',
            fontSize: 16, outline: 'none',
            marginBottom: error ? 6 : 14,
          }}
        />

        {error && (
          <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#1a1917', color: '#fff',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}>
          登入
        </button>

        <div style={{ marginTop: 18, padding: '10px 12px', background: '#fafaf8', borderRadius: 8, fontSize: 11, color: '#888', textAlign: 'center' }}>
          💡 Demo 提示：所有角色預設密碼皆為 <strong style={{ color: '#1a1917' }}>0000</strong>
        </div>
      </div>
    </div>
  )
}
