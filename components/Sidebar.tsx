'use client'

// ============================================================
// components/Sidebar.tsx — 階段 14 + 視覺改版（粉紅科技風）
// ============================================================
// 業務邏輯 100% 保留（切身份、登出、權限過濾、SSR-safe mount、
// 4-user dropdown、密碼 modal、mobile drawer）。僅前端視覺重寫。
// ============================================================

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  getCurrentUser, getEffectiveRole, getUserRoleLabel,
  listAccessiblePages, listAllUsers, login as apiLogin, logout as apiLogout,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { PageKey } from '@/data/permissions'
import { COLORS, FONTS } from './theme/tokens'
import QiuQiu from './QiuQiu'

// 角色顏色 — 改用 token 統一管理（取代舊金/藍/灰）
function roleColor(userId: string): string {
  const role = getEffectiveRole(userId)
  if (role === 'owner')   return COLORS.roleOwner    // 粉
  if (role === 'manager') return COLORS.roleManager  // 紫
  if (role === 'staff')   return COLORS.roleStaff    // 灰粉
  return COLORS.ink500
}

interface NavLink {
  pageKey: PageKey
  href: string
  label: string
  icon: string
}

// —— Nav 清單（順序 = sidebar 顯示順序）——
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

// 場館 dot 顏色（給 booking site dot 用）
const BOOKING_DOT_COLORS = [COLORS.pink500, COLORS.purple, COLORS.cyan, COLORS.pink400, COLORS.amber, COLORS.purpleLight, COLORS.pink300]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pathname = usePathname()

  // 階段 14：切換身份的密碼 modal 狀態
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null)
  const [switchPassword, setSwitchPassword] = useState('')
  const [switchError, setSwitchError] = useState('')

  useStoreSync()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  const currentUser = getCurrentUser()
  const allUsers = listAllUsers()

  const accessibleSet: Set<PageKey> = mounted && currentUser
    ? new Set(listAccessiblePages(currentUser.id))
    : new Set(ALL_LINKS.map(l => l.pageKey))

  const visibleLinks = ALL_LINKS.filter(l => accessibleSet.has(l.pageKey))

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
  }

  const switchTargetUser = switchTargetId ? allUsers.find(u => u.id === switchTargetId) : null
  const switchTargetLabel = switchTargetId && mounted ? getUserRoleLabel(switchTargetId) : ''

  const NavContent = () => (
    <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
      <nav style={{ padding: '12px 10px' }}>
        {visibleLinks.map((link, idx) => {
          const active = pathname === link.href
          const num = String(idx + 1).padStart(2, '0')
          return (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: active ? '9px 10px' : '7px 10px',
              borderRadius: 9, marginBottom: active ? 3 : 1,
              color: active ? '#fff' : COLORS.ink700,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              background: active
                ? `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`
                : 'transparent',
              boxShadow: active
                ? '0 0 14px rgba(255,45,138,0.4), 0 4px 12px -2px rgba(255,45,138,0.45)'
                : 'none',
              position: 'relative',
              animation: active ? 'vop-glow 2.6s ease-in-out infinite' : undefined,
              transition: 'background 0.15s ease',
            }}>
              {active && (
                <span style={{
                  position: 'absolute', left: -1, top: 6, bottom: 6, width: 3,
                  background: '#fff', borderRadius: 2,
                  boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                }} />
              )}
              <span style={{
                display: 'inline-flex', width: 14, justifyContent: 'center',
                fontSize: 12,
                color: active ? '#fff' : COLORS.pink700,
              }}>{link.icon}</span>
              <span>{link.label}</span>
              <span className="vop-mono" style={{
                marginLeft: 'auto',
                fontSize: 9,
                opacity: active ? 0.85 : 1,
                color: active ? '#fff' : COLORS.ink200,
                fontWeight: 700,
              }}>{num}</span>
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '0 10px 8px' }}>
        <div className="vop-mono" style={{
          fontSize: 9, color: COLORS.pink700,
          fontWeight: 800, letterSpacing: '0.14em',
          padding: '8px 12px 4px',
        }}>
          [ BOOKING SITES ]
        </div>
        {BOOKING_LINKS.map((link, idx) => {
          const active = pathname.startsWith(link.href)
          const dot = BOOKING_DOT_COLORS[idx % BOOKING_DOT_COLORS.length]
          return (
            <a key={link.href} href={link.href} target="_blank" style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '6px 10px', borderRadius: 8, marginBottom: 1,
              color: active ? COLORS.pink700 : COLORS.ink500,
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              background: active ? 'rgba(255,45,138,0.1)' : 'transparent',
            }}>
              <span style={{
                width: 14, textAlign: 'center', fontSize: 9, color: dot,
              }}>●</span>
              <span>{link.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: COLORS.ink200 }}>↗</span>
            </a>
          )
        })}
      </div>
    </div>
  )

  const currentRoleLabel = mounted && currentUser ? getUserRoleLabel(currentUser.id) : '—'
  const currentRoleColor = mounted && currentUser ? roleColor(currentUser.id) : COLORS.pink500

  return (
    <>
      <aside id="sidebar" style={{
        width: 210,
        background: `linear-gradient(180deg, ${COLORS.pink100} 0%, #ffd1de 100%)`,
        color: COLORS.ink900,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        borderRight: `1px solid ${COLORS.pink200}`,
        fontFamily: FONTS.sans,
      }}>
        {/* —— sidebar 內部 grid 紋理 —— */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,45,138,0.05) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,45,138,0.05) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* —— Logo 區 —— */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: `1px solid rgba(255,45,138,0.22)`,
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <QiuQiu variant="face" size={26} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: COLORS.ink900 }}>
                VolleyOps
              </div>
              <div className="vop-mono" style={{
                fontSize: 8.5, color: COLORS.pink700,
                letterSpacing: '0.15em', marginTop: 1, fontWeight: 700,
              }}>
                // 館管系統
              </div>
            </div>
          </div>
        </div>

        <NavContent />

        {/* —— 球球 watermark（半透明、不可點）—— */}
        <div style={{
          position: 'absolute', bottom: 70, right: 4,
          opacity: 0.42, pointerEvents: 'none', zIndex: 0,
        }}>
          <QiuQiu variant="mini" size={58} />
        </div>

        {/* —— 底部：使用者切換 —— */}
        <div style={{
          padding: '11px 14px',
          borderTop: `1px solid rgba(255,45,138,0.22)`,
          background: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(8px)',
          fontSize: 12, color: COLORS.ink500,
          position: 'relative', zIndex: 1,
        }}>
          {pickerOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 10, right: 10,
              background: '#fff',
              border: `1px solid ${COLORS.pink200}`,
              borderRadius: 11,
              boxShadow: '0 -8px 24px -4px rgba(255,45,138,0.25), 0 0 0 1px rgba(255,45,138,0.06)',
              marginBottom: 6, overflow: 'hidden',
            }}>
              <div className="vop-mono" style={{
                padding: '9px 12px', fontSize: 9, color: COLORS.pink700,
                fontWeight: 800, letterSpacing: '0.14em',
                background: COLORS.pink50,
                borderBottom: `1px solid ${COLORS.pink100}`,
              }}>
                [ SWITCH IDENTITY ]
              </div>
              {allUsers.map(u => {
                const active = currentUser?.id === u.id
                return (
                  <button key={u.id}
                    onClick={() => requestSwitch(u.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '10px 12px', border: 'none', cursor: 'pointer',
                      background: active ? COLORS.pink50 : '#fff',
                      color: active ? COLORS.ink900 : COLORS.ink700,
                      fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: `1px solid ${COLORS.pink50}`,
                      transition: 'background 0.15s ease',
                    }}>
                    <span>
                      <span style={{ color: roleColor(u.id), fontWeight: 700 }}>{u.name}</span>
                      <span style={{ color: COLORS.ink300, marginLeft: 6, fontSize: 11 }}>
                        {mounted ? getUserRoleLabel(u.id) : u.globalRole}
                      </span>
                    </span>
                    {active && <span style={{ color: COLORS.pink500, fontSize: 12 }}>✓</span>}
                  </button>
                )
              })}
              <div style={{ borderTop: `1px solid ${COLORS.pink100}` }}>
                <button
                  onClick={() => { setPickerOpen(false); onLogout() }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', border: 'none', cursor: 'pointer',
                    background: 'transparent', color: COLORS.danger,
                    fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <span>↩</span><span>登出</span>
                </button>
              </div>
            </div>
          )}

          <button onClick={() => setPickerOpen(o => !o)} style={{
            width: '100%', textAlign: 'left',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: COLORS.ink500, fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: currentRoleColor, fontWeight: 700, fontSize: 12 }}>
                {currentUser?.name ?? '未登入'}
              </div>
              <span style={{ fontSize: 10, color: COLORS.pink700 }}>{pickerOpen ? '▾' : '▴'}</span>
            </div>
            <div className="vop-mono" style={{
              marginTop: 2, fontSize: 9, color: COLORS.ink500,
              letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
            }}>
              {currentRoleLabel}
            </div>
          </button>
        </div>
      </aside>

      {/* —— Mobile topbar —— */}
      <div id="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: `linear-gradient(90deg, ${COLORS.pink100} 0%, #ffd1de 100%)`,
        color: COLORS.ink900,
        padding: '14px 20px', display: 'none',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${COLORS.pink200}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QiuQiu variant="face" size={22} />
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.ink900 }}>VolleyOps</div>
        </div>
        <button onClick={() => setOpen(!open)} style={{
          background: 'none', border: 'none', color: COLORS.ink900, fontSize: 22, cursor: 'pointer',
        }}>☰</button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(45,27,46,0.55)' }}
          onClick={() => setOpen(false)}>
          <div style={{
            width: 220, height: '100%',
            background: `linear-gradient(180deg, ${COLORS.pink100} 0%, #ffd1de 100%)`,
            display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${COLORS.pink200}`,
          }}
            onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '20px 20px 16px',
              borderBottom: `1px solid rgba(255,45,138,0.22)`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <QiuQiu variant="face" size={24} />
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.ink900 }}>VolleyOps</div>
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

      {/* —— 階段 14：切換身份的密碼 modal —— */}
      {switchTargetId && switchTargetUser && (
        <div
          onClick={cancelSwitch}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(45,27,46,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16,
              padding: '24px 22px', width: '100%', maxWidth: 360,
              boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3), 0 0 0 1px rgba(255,45,138,0.12)',
              position: 'relative', overflow: 'hidden',
            }}>
            {/* 角落 HUD 標記 */}
            <span style={{ position:'absolute', top:8, left:8, width:9, height:9, borderTop:`1.6px solid ${COLORS.pink500}`, borderLeft:`1.6px solid ${COLORS.pink500}` }} />
            <span style={{ position:'absolute', top:8, right:8, width:9, height:9, borderTop:`1.6px solid ${COLORS.pink500}`, borderRight:`1.6px solid ${COLORS.pink500}` }} />
            <span style={{ position:'absolute', bottom:8, left:8, width:9, height:9, borderBottom:`1.6px solid ${COLORS.pink500}`, borderLeft:`1.6px solid ${COLORS.pink500}` }} />
            <span style={{ position:'absolute', bottom:8, right:8, width:9, height:9, borderBottom:`1.6px solid ${COLORS.pink500}`, borderRight:`1.6px solid ${COLORS.pink500}` }} />

            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <QiuQiu variant="face" size={52} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.ink900 }}>
                切換到 {switchTargetUser.name}
              </div>
              <div style={{
                fontSize: 12, color: roleColor(switchTargetUser.id),
                marginTop: 4, fontWeight: 700,
              }}>
                {switchTargetLabel}
              </div>
            </div>

            <div className="vop-mono" style={{
              fontSize: 10, color: COLORS.pink700,
              marginBottom: 6, fontWeight: 800, letterSpacing: '0.14em',
            }}>
              [ PASSWORD ]
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
                border: switchError ? `1.5px solid ${COLORS.danger}` : `1.5px solid ${COLORS.pink200}`,
                fontSize: 15, outline: 'none',
                marginBottom: switchError ? 6 : 14,
                fontFamily: FONTS.mono,
                letterSpacing: '0.2em',
                color: COLORS.ink900,
                background: COLORS.pink50,
              }}
            />

            {switchError && (
              <div style={{ fontSize: 12, color: COLORS.danger, marginBottom: 14, fontWeight: 600 }}>
                ⚠ {switchError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={cancelSwitch}
                style={{
                  flex: 1, padding: '11px 14px',
                  background: '#fff', color: COLORS.ink700,
                  border: `1.5px solid ${COLORS.pink200}`, borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                取消
              </button>
              <button
                onClick={confirmSwitch}
                style={{
                  flex: 1, padding: '11px 14px',
                  background: `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
                  color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 14px -2px rgba(255,45,138,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                  letterSpacing: '0.04em',
                }}>
                確認切換
              </button>
            </div>

            <div className="vop-mono" style={{
              marginTop: 14, fontSize: 10, color: COLORS.ink300,
              textAlign: 'center', letterSpacing: '0.08em',
            }}>
              💡 DEMO · 預設密碼皆為 <strong style={{ color: COLORS.pink500 }}>0000</strong>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
