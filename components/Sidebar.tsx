'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const links = [
    { href: '/dashboard',        label: '總覽',     icon: '▦',  group: 'main' },
    { href: '/sessions',         label: '場次管理', icon: '📋', group: 'main' },
    { href: '/checkin',          label: '前台操作', icon: '✓',  group: 'main' },
    { href: '/customers',        label: '客戶資料', icon: '👤', group: 'main' },
    { href: '/products',         label: '商品管理', icon: '📦', group: 'main' },
    { href: '/finance',          label: '財務報表', icon: '💰', group: 'main' },
    { href: '/finance/payments', label: '報表匯出', icon: '📤', group: 'main' },
    { href: '/audit',            label: '操作紀錄', icon: '🔍', group: 'main' },
    { href: '/integrations',     label: '整合設定', icon: '🔗', group: 'main' },
  ]

  const bookingLinks = [
    { href: '/book/flywing',    label: '飛翼館', icon: '🏐' },
    { href: '/book/ace',        label: 'Ace 館', icon: '🏐' },
    { href: '/book/magicblock', label: '球魔方', icon: '🏐' },
    { href: '/book/hibi',       label: '日日館', icon: '🏐' },
    { href: '/book/playone',    label: 'Playone',icon: '🏐' },
    { href: '/book/smash',      label: '就醬瘋',  icon: '🏐' },
  ]

  const NavContent = () => (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <nav style={{ padding: '12px 10px' }}>
        {links.map(link => {
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
        {bookingLinks.map(link => {
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
        <div style={{ padding: '14px 20px', borderTop: '1px solid #333', fontSize: 12, color: '#888' }}>
          <div style={{ color: '#d4a843', fontWeight: 600 }}>陳老闆</div>
          <div>最高權限</div>
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
