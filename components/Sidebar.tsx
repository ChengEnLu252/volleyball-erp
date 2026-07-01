'use client'

// ============================================================
// components/Sidebar.tsx — 階段 14 + 視覺改版（粉紅科技風）
// ============================================================
// 業務邏輯 100% 保留（切身份、登出、權限過濾、SSR-safe mount、
// 4-user dropdown、密碼 modal、mobile drawer）。僅前端視覺重寫。
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  getCurrentUser, getCurrentEffectiveRole, getCurrentRoleLabel,
  listCurrentAccessiblePages,
  getPendingOrderCount,
} from '@/data/api'
import { loadNotificationsAction } from '@/app/actions/notifications'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { EffectiveRole, PageKey } from '@/data/permissions'
import { COLORS, FONTS } from './theme/tokens'
import QiuQiu from './QiuQiu'

// 角色顏色 — 改用 token 統一管理
function roleColorFor(role: EffectiveRole): string {
  if (role === 'owner')   return COLORS.roleOwner    // 粉
  if (role === 'manager') return COLORS.roleManager  // 紫
  if (role === 'staff')   return COLORS.roleStaff    // 灰粉
  return COLORS.ink500
}

// —— 階段 21：側欄分類 ——
// 把 19 個扁平項目歸成 5 大類，每類有標題；權限過濾後若整類為空則不顯示標題。
type NavGroup = 'ops' | 'commerce' | 'finance' | 'people' | 'system'

const GROUP_LABEL: Record<NavGroup, string> = {
  ops:      '營運',
  commerce: '商品 / 商城',
  finance:  '財務 / 對帳',
  people:   '人員 / 績效',
  system:   '系統',
}

// 類別顯示順序（= sidebar 由上而下）
const GROUP_ORDER: NavGroup[] = ['ops', 'commerce', 'finance', 'people', 'system']

interface NavLink {
  pageKey: PageKey
  href: string
  label: string
  icon: string
  group: NavGroup
}

// —— Nav 清單（順序 = sidebar 顯示順序；group = 所屬類別）——
const ALL_LINKS: NavLink[] = [
  // 營運
  { pageKey: 'dashboard',        href: '/dashboard',        label: '總覽',         icon: '▦',  group: 'ops' },
  { pageKey: 'ai-summary',       href: '/ai-summary',       label: 'AI 營運摘要', icon: '🤖', group: 'ops' },
  { pageKey: 'notifications',    href: '/notifications',    label: '通知',         icon: '🔔', group: 'ops' },
  { pageKey: 'sessions',         href: '/sessions',         label: '場次管理',     icon: '📋', group: 'ops' },
  { pageKey: 'booking-overview', href: '/booking-overview', label: '報名熱度',     icon: '📈', group: 'ops' },
  { pageKey: 'checkin',          href: '/checkin',          label: '前台操作',     icon: '✓',  group: 'ops' },
  { pageKey: 'customers',        href: '/customers',        label: '客戶資料',     icon: '👤', group: 'ops' },
  // 商品 / 商城
  { pageKey: 'products',         href: '/products',         label: '商品管理',     icon: '📦', group: 'commerce' },
  { pageKey: 'shop-products',    href: '/shop-products',    label: '商城商品',     icon: '🏷️', group: 'commerce' },
  { pageKey: 'orders',           href: '/orders',           label: '商城訂單',     icon: '🛒', group: 'commerce' },
  // 財務 / 對帳
  { pageKey: 'finance',          href: '/finance',          label: '財務報表',     icon: '💰', group: 'finance' },
  { pageKey: 'reconciliation',   href: '/reconciliation',   label: '對帳系統',     icon: '⚖️', group: 'finance' },
  { pageKey: 'finance/refunds',  href: '/finance/refunds',  label: '退費處理',     icon: '💸', group: 'finance' },
  { pageKey: 'finance/payments', href: '/finance/payments', label: '報表匯出',     icon: '📤', group: 'finance' },
  // 人員 / 績效
  { pageKey: 'staff-pay',        href: '/reconciliation/staff-pay', label: '員工薪資',     icon: '🧑‍💼', group: 'people' },
  { pageKey: 'goals',            href: '/goals',            label: '館長目標',     icon: '🎯', group: 'people' },
  { pageKey: 'captains',         href: '/captains',         label: '主揪管理',     icon: '🪝', group: 'people' },
  // 系統
  { pageKey: 'approvals',        href: '/approvals',        label: '帳號審核',     icon: '🪪', group: 'system' },
  { pageKey: 'audit',            href: '/audit',            label: '操作紀錄',     icon: '🔍', group: 'system' },
  { pageKey: 'evidence',         href: '/evidence',         label: '上傳憑證',     icon: '📎', group: 'system' },
  { pageKey: 'integrations',     href: '/integrations',     label: '整合設定',     icon: '🔗', group: 'system' },
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

  useStoreSync()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  // P2.3c：未讀通知數改讀 DB（每次路由變動 + 掛載時重抓）
  const [dbUnread, setDbUnread] = useState(0)
  useEffect(() => {
    let alive = true
    loadNotificationsAction().then((res) => { if (alive) setDbUnread(res.ok ? res.unread : 0) })
    return () => { alive = false }
  }, [pathname])

  const currentUser = getCurrentUser()

  const accessibleSet: Set<PageKey> = mounted && currentUser
    ? new Set(listCurrentAccessiblePages())
    : new Set(ALL_LINKS.map(l => l.pageKey))

  const visibleLinks = ALL_LINKS.filter(l => accessibleSet.has(l.pageKey))

  // 階段 16 → P2.3c：未讀通知數（鈴鐺 badge）改讀 DB（server action）
  const unreadCount = dbUnread
  // 階段 17：待處理訂單數（商城訂單 badge）
  const pendingOrders = mounted && currentUser ? getPendingOrderCount() : 0

  const onLogout = () => { void signOut({ callbackUrl: '/dashboard' }) }

  const NavContent = () => (
    <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
      <nav style={{ padding: '12px 10px' }}>
        {(() => {
          // 全域連續編號（跨類別）— 與舊版一致
          let globalIdx = 0
          return GROUP_ORDER.map(group => {
            const linksInGroup = visibleLinks.filter(l => l.group === group)
            if (linksInGroup.length === 0) return null  // 整類被權限過濾掉 → 不顯示標題
            return (
              <div key={group} style={{ marginBottom: 6 }}>
                {/* —— 類別標題 —— */}
                <div className="vop-mono" style={{
                  fontSize: 9, color: COLORS.pink700,
                  fontWeight: 800, letterSpacing: '0.12em',
                  padding: '8px 12px 4px',
                }}>
                  {GROUP_LABEL[group]}
                </div>
                {linksInGroup.map(link => {
                  const active = pathname === link.href
                  const num = String(++globalIdx).padStart(2, '0')
                  const badgeCount =
                    link.pageKey === 'notifications' ? unreadCount
                    : link.pageKey === 'orders' ? pendingOrders
                    : 0
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className={`vop-navlink${active ? ' is-active' : ''}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: active ? '9px 10px' : '7px 10px',
                        borderRadius: 9, marginBottom: active ? 3 : 1,
                        color: active ? '#fff' : COLORS.ink700,
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: active ? 800 : 700,
                        background: active
                          ? `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`
                          : 'transparent',
                        boxShadow: active
                          ? '0 0 14px rgba(255,45,138,0.4), 0 4px 12px -2px rgba(255,45,138,0.45)'
                          : 'none',
                        position: 'relative',
                        animation: active ? 'vop-glow 2.6s ease-in-out infinite' : undefined,
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
                      {badgeCount > 0 ? (
                        <span style={{
                          marginLeft: 'auto',
                          minWidth: 16, height: 16, padding: '0 5px',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 8,
                          background: active ? '#fff' : COLORS.pink500,
                          color: active ? COLORS.pink600 : '#fff',
                          fontSize: 10, fontWeight: 800, lineHeight: 1,
                          boxShadow: active ? 'none' : '0 0 8px rgba(255,45,138,0.5)',
                        }}>{badgeCount > 99 ? '99+' : badgeCount}</span>
                      ) : (
                        <span className="vop-mono" style={{
                          marginLeft: 'auto',
                          fontSize: 9,
                          opacity: active ? 0.85 : 1,
                          color: active ? '#fff' : COLORS.ink200,
                          fontWeight: 700,
                        }}>{num}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })
        })()}
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
              fontWeight: active ? 800 : 700,
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
        <a href="/shop" target="_blank" style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '6px 10px', borderRadius: 8, marginBottom: 1, marginTop: 2,
          color: pathname.startsWith('/shop') ? COLORS.pink700 : COLORS.ink500,
          textDecoration: 'none', fontSize: 11,
          fontWeight: pathname.startsWith('/shop') ? 800 : 700,
          background: pathname.startsWith('/shop') ? 'rgba(255,45,138,0.1)' : 'transparent',
        }}>
          <span style={{ width: 14, textAlign: 'center', fontSize: 11 }}>🛍️</span>
          <span>線上商城</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: COLORS.ink200 }}>↗</span>
        </a>
      </div>
    </div>
  )

  const currentRoleLabel = mounted && currentUser ? getCurrentRoleLabel() : '—'
  const currentRoleColor = mounted && currentUser ? roleColorFor(getCurrentEffectiveRole()) : COLORS.pink500

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
                多爾森健康
              </div>
              <div className="vop-mono" style={{
                fontSize: 9, color: COLORS.pink700,
                letterSpacing: '0.1em', marginTop: 1, fontWeight: 800,
              }}>
                ERP 系統
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

        {/* —— 底部：目前使用者 + 登出 —— */}
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
              <button
                onClick={() => { setPickerOpen(false); onLogout() }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '11px 12px', border: 'none', cursor: 'pointer',
                  background: 'transparent', color: COLORS.danger,
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span>↩</span><span>登出</span>
              </button>
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
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.ink900 }}>多爾森健康</div>
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
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.ink900 }}>多爾森健康</div>
            </div>
            <NavContent />
          </div>
        </div>
      )}

      <style>{`
        .vop-navlink {
          transition: background 0.12s ease, transform 0.06s ease, padding 0.1s ease;
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
        }
        .vop-navlink:not(.is-active):hover {
          background: rgba(255,45,138,0.10) !important;
        }
        .vop-navlink:not(.is-active):active {
          background: rgba(255,45,138,0.18) !important;
          transform: scale(0.985);
        }
        @media (max-width: 768px) {
          #sidebar { display: none !important; }
          #mobile-topbar { display: flex !important; }
        }
      `}</style>
    </>
  )
}
