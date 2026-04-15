'use client'

import { useState } from 'react'

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: '總覽',     icon: '▦'  },
    { href: '/sessions',  label: '場次管理', icon: '📋' },
    { href: '/checkin',   label: '前台操作', icon: '✓'  },
    { href: '/customers', label: '客戶資料', icon: '👤' },
    { href: '/products',  label: '商品管理', icon: '📦' },
    { href: '/finance',   label: '財務報表', icon: '💰' },
  ]

  return (
    <>
      <aside id="sidebar" style={{
        width: 200,
        background: '#1a1917',
        color: '#f5f4f0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #333' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>VolleyOps</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>排球場館管理系統</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {links.map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, marginBottom: 2,
              color: '#ccc', textDecoration: 'none', fontSize: 13,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2a2927')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #333', fontSize: 12, color: '#888' }}>
          <div style={{ color: '#d4a843', fontWeight: 600 }}>陳老闆</div>
          <div>最高權限</div>
        </div>
      </aside>

      <div id="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1a1917', color: '#f5f4f0',
        padding: '14px 20px',
        display: 'none',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>VolleyOps</div>
        <button onClick={() => setOpen(!open)} style={{
          background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
        }}>☰</button>
      </div>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.6)',
        }} onClick={() => setOpen(false)}>
          <div style={{
            width: 220, height: '100%', background: '#1a1917',
            padding: '20px 10px',
          }} onClick={e => e.stopPropagation()}>
            {links.map(link => (
              <a key={link.href} href={link.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 8, marginBottom: 4,
                color: '#ccc', textDecoration: 'none', fontSize: 15,
              }}>
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
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
