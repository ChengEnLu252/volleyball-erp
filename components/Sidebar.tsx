'use client'

export default function Sidebar() {
  const links = [
    { href: '/dashboard', label: '總覽',     icon: '▦'  },
    { href: '/sessions',  label: '場次管理', icon: '📋' },
    { href: '/checkin',   label: '前台操作', icon: '✓'  },
    { href: '/customers', label: '客戶資料', icon: '👤' },
    { href: '/products',  label: '商品管理', icon: '📦' },
    { href: '/finance',   label: '財務報表', icon: '💰' },
  ]

  return (
    <aside style={{
      width: 200,
      background: '#1a1917',
      color: '#f5f4f0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #333' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          VolleyOps
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          排球場館管理系統
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {links.map(link => (
          <a // <-- 這裡必須加上標籤名稱 'a'
            key={link.href}
            href={link.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              marginBottom: 2,
              color: '#ccc',
              textDecoration: 'none',
              fontSize: 13,
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
  )
}