'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  getCurrentUser, getEffectiveRole, getUserRoleLabel,
  listAccessiblePages, listAllUsers, login as apiLogin, logout as apiLogout,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { PageKey } from '@/data/permissions'

// 角色顏色 — 按 effective role（owner 金 / manager 藍 / staff 灰）
function roleColor(userId: string): string {
  const role = getEffectiveRole(userId)
  if (role === 'owner')   return '#d4a843'
  if (role === 'manager') return '#7fb8e8'
  if (role === 'staff')   return '#9ca3af'
  return '#666'
}

interface NavLink {
  pageKey: PageKey
  href: string
  label: string
  icon: string
}

// 完整 nav 清單（順序固定 = sidebar 顯示順序）
// 對外公開頁（/book、/captain）不在此清單，因為它們不在權限矩陣管轄。
const ALL_LINKS: NavLink[] = [
  { pageKey: 'dashboard',        href: '/dashboard',        label: '總覽',     icon: '▦'  },
  { pageKey: 'sessions',         href: '/sessions',         label: '場次管理', icon: '📋' },
  { pageKey: 'booking-overview', href: '/booking-overview', label: '報名熱度', icon: '📈' },
  { pageKey: 'checkin',          href: '/checkin',          label: '前台操作', icon: '✓'  },
  { pageKey: 'customers',        href: '/customers',        label: '客戶資料', icon: '👤' },
  { pageKey: 'products',         href: '/products',         label: '商品管理', icon: '📦' },
  { pageKey: 'finance',          href: '/finance',          label: '財務報表', icon: '💰' },
  { pageKey: 'performance',      href: '/performance',      label: '館長績效', icon: '🏆' },
  { pageKey: 'reconciliation',   href: '/reconciliation',   label: '對帳系統', icon: '⚖️' },
  { pageKey: 'captains',         href: '/captains',         label: '主揪管理', icon: '🎯' },
  { pageKey: 'finance/payments', href: '/finance/payments', label: '報表匯出', icon: '📤' },
  { pageKey: 'finance/refunds',  href: '/finance/refunds',  label: '退費處理', icon: '💸' },
  { pageKey: 'audit',            href: '/audit',            label: '操作紀錄', icon: '🔍' },
  { pageKey: 'evidence',         href: '/evidence',         label: '上傳憑證', icon: '📎' },
  { pageKey: 'integrations',     href: '/integrations',     label: '整合設定', icon: '🔗' },
]

const BOOKING_LINKS = [
  { href: '/book/flywing',    label: '飛翼',     icon: '🏐' },
  { href: '/book/ace2.0',     label: 'Ace 2.0',  icon: '🏐' },
  { href: '/book/ace3.0',     label: 'Ace 3.0',  icon: '🏐' },
  { href: '/book/magicblock', label: '球魔方 2.0', icon: '🏐' },
  { href: '/book/hibi',       label: 'Hibi 日日', icon: '🏐' },
  { href: '/book/playone',    label: 'play one', icon: '🏐' },
  { href: '/book/smash',      label: '就醬瘋',    icon: '🏐' },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pathname = usePathname()

  // 階段 14：切換身份的密碼 modal 狀態
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null)
  const [switchPassword, setSwitchPassword] = useState('')
  const [switchError, setSwitchError] = useState('')

  // 訂閱 store 變更（切視角 / mutation 都會 trigger re-render）
  useStoreSync()

  // SSR-safe mount flag — 沒 mount 前用「全部都顯示」的保守 fallback，
  // 避免 server 跟 client 第一次 render 不一致
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  const currentUser = getCurrentUser()
  const allUsers = listAllUsers()

  // 算「目前 user 可看的 page key 集合」
  const accessibleSet: Set<PageKey> = mounted && currentUser
    ? new Set(listAccessiblePages(currentUser.id))
    : new Set(ALL_LINKS.map(l => l.pageKey))

  const visibleLinks = ALL_LINKS.filter(l => accessibleSet.has(l.pageKey))

  // 階段 14：點選 dropdown 中其他使用者 → 開密碼 modal
  const requestSwitch = (userId: string) => {
    if (userId === currentUser?.id) {
      setPickerOpen(false)
      return
    }
    setSwitchTargetId(userId)
    setSwitchPassword('')
    setSwitchError('')
    setPickerOpen(false)
  }

  const confirmSwitch = () => {
    if (!switchTargetId) return
    if (!switchPassword) {
      setSwitchError('請輸入密碼')
      return
    }
    const ok = apiLogin(switchTargetId, switchPassword)
    if (!ok) {
      setSwitchError('密碼錯誤')
      setSwitchPassword('')
      return
    }
    // 成功
    setSwitchTargetId(null)
    setSwitchPassword('')
    setSwitchError('')
  }

  const cancelSwitch = () => {
    setSwitchTargetId(null)
    setSwitchPassword('')
    setSwitchError('')
  }

  const onLogout = () => {
    apiLogout()
    // LoginGate 會自動 re-render 出 LoginCard
  }

  const switchTargetUser = switchTargetId ? allUsers.find(u => u.id === switchTargetId) : null
  const switchTargetLabel = switchTargetId && mounted ? getUserRoleLabel(switchTargetId) : ''

  const NavContent = () => (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <nav style={{ padding: '12px 10px' }}>
        {visibleLinks.map(link => {
          const active = pathname === link.href
          return (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, marginBottom: 2,
              color: active ? '#fff' : '#ccc',
              textDecoration: 'none', fontSize: 13,
              background: active ? '#2a2927' : 'transparent',
              borderLeft: active ? '3px solid #d4a843' : '3px solid transparent',
            }}>
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '0 10px 8px' }}>
        <div style={{ fontSize: 10, color: '#555', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 12px 4px' }}>
          客戶報名頁面
        </div>
        {BOOKING_LINKS.map(link => {
          const active = pathname.startsWith(link.href)
          return (
            <a key={link.href} href={link.href} target="_blank" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', borderRadius: 8, marginBottom: 2,
              color: active ? '#d4a843' : '#666',
              textDecoration: 'none', fontSize: 12,
              background: active ? '#2a2927' : 'transparent',
            }}>
              <span style={{ fontSize: 10 }}>🔗</span>
              <span>{link.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#444' }}>↗</span>
            </a>
          )
        })}
      </div>
    </div>
  )

  // 顯示用 — current user role label（動態）
  const currentRoleLabel = mounted && currentUser ? getUserRoleLabel(currentUser.id) : '—'
  const currentRoleColor = mounted && currentUser ? roleColor(currentUser.id) : '#d4a843'

  return (
    <>
      <aside id="sidebar" style={{
        width: 210, background: '#1a1917', color: '#f5f4f0',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        // 階段 12 修：sticky + 100vh，避免長頁面把 sidebar 撐高、底部 picker 被擠出 viewport
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #333' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>VolleyOps</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>排球場館管理系統</div>
        </div>
        <NavContent />
        <div style={{ padding: '14px 20px', borderTop: '1px solid #333', fontSize: 12, color: '#888', position: 'relative' }}>
          {/* 4-user dropdown — 展開時往上彈出 */}
          {pickerOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 12, right: 12,
              background: '#2a2825', border: '1px solid #444', borderRadius: 8,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
              marginBottom: 4, overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 12px', fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                切換身份（demo）
              </div>
              {allUsers.map(u => {
                const active = currentUser?.id === u.id
                return (
                  <button key={u.id}
                    onClick={() => requestSwitch(u.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '10px 12px', border: 'none', cursor: 'pointer',
                      background: active ? '#3a3835' : 'transparent',
                      color: active ? '#fff' : '#ccc',
                      fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                    <span>
                      <span style={{ color: roleColor(u.id), fontWeight: 600 }}>{u.name}</span>
                      <span style={{ color: '#777', marginLeft: 6, fontSize: 11 }}>
                        {mounted ? getUserRoleLabel(u.id) : u.globalRole}
                      </span>
                    </span>
                    {active && <span style={{ color: '#9ae6b4', fontSize: 10 }}>✓</span>}
                  </button>
                )
              })}
              <div style={{ borderTop: '1px solid #444' }}>
                <button
                  onClick={() => { setPickerOpen(false); onLogout() }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', border: 'none', cursor: 'pointer',
                    background: 'transparent', color: '#e85d3a',
                    fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <span>↩</span><span>登出</span>
                </button>
              </div>
            </div>
          )}

          {/* 目前登入身份（點擊切換）*/}
          <button onClick={() => setPickerOpen(o => !o)} style={{
            width: '100%', textAlign: 'left',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#888', fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: currentRoleColor, fontWeight: 600 }}>
                {currentUser?.name ?? '未登入'}
              </div>
              <span style={{ fontSize: 10, color: '#666' }}>{pickerOpen ? '▾' : '▴'}</span>
            </div>
            <div style={{ marginTop: 2 }}>{currentRoleLabel}</div>
          </button>
        </div>
      </aside>

      <div id="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1a1917', color: '#f5f4f0',
        padding: '14px 20px', display: 'none',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>VolleyOps</div>
        <button onClick={() => setOpen(!open)} style={{
          background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
        }}>☰</button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpen(false)}>
          <div style={{ width: 220, height: '100%', background: '#1a1917', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #333' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>VolleyOps</div>
            </div>
            <NavContent />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          #sidebar { display: none !important; }
          #mobile-topbar { display: flex !important; }
        }
      `}</style>

      {/* 階段 14：切換身份的密碼 modal */}
      {switchTargetId && switchTargetUser && (
        <div
          onClick={cancelSwitch}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14,
              padding: '24px 22px', width: '100%', maxWidth: 340,
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🔐</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1917' }}>
                切換到 {switchTargetUser.name}
              </div>
              <div style={{ fontSize: 12, color: roleColor(switchTargetUser.id), marginTop: 4, fontWeight: 500 }}>
                {switchTargetLabel}
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 500 }}>
              密碼
            </div>
            <input
              type="password"
              value={switchPassword}
              onChange={e => { setSwitchPassword(e.target.value); setSwitchError('') }}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmSwitch()
                if (e.key === 'Escape') cancelSwitch()
              }}
              placeholder="輸入 4 位數密碼"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 14px', borderRadius: 10,
                border: switchError ? '1px solid #dc2626' : '1px solid #e8e6e0',
                fontSize: 15, outline: 'none',
                marginBottom: switchError ? 6 : 14,
              }}
            />

            {switchError && (
              <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
                ⚠ {switchError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={cancelSwitch}
                style={{
                  flex: 1, padding: '11px 14px',
                  background: '#fff', color: '#666',
                  border: '1px solid #e8e6e0', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                取消
              </button>
              <button
                onClick={confirmSwitch}
                style={{
                  flex: 1, padding: '11px 14px',
                  background: '#1a1917', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                確認切換
              </button>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
              💡 Demo 預設密碼皆為 0000
            </div>
          </div>
        </div>
      )}
    </>
  )
}
