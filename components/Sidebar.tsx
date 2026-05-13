'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  getCurrentUser, getEffectiveRole, getUserRoleLabel,
  listAccessiblePages, listAllUsers, switchCurrentUser,
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
                    onClick={() => { switchCurrentUser(u.id); setPickerOpen(false) }}
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
    </>
  )
}
