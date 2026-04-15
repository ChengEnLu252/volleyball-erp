'use client'

import { MOCK_SESSIONS, MOCK_VENUES } from '@/data/mock'

const SESSION_TYPE_LABEL: Record<string, string> = {
  beginner: '新手場', intermediate: '中階場', advanced: '進階場', mixed: '混合場',
}
const SESSION_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  beginner:     { bg: '#dcfce7', text: '#166534' },
  intermediate: { bg: '#dbeafe', text: '#1e40af' },
  advanced:     { bg: '#fce7f3', text: '#9d174d' },
  mixed:        { bg: '#f3e8ff', text: '#6b21a8' },
}
const NET_HEIGHT_LABEL: Record<string, string> = {
  female: '女網', male: '男網', adjustable: '可調',
}
const STATUS_LABEL: Record<string, string> = {
  open: '報名中', full: '已額滿', cancelled: '已取消', completed: '已結束',
}
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  open:      { bg: '#dcfce7', text: '#166534' },
  full:      { bg: '#fef3c7', text: '#92400e' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
  completed: { bg: '#f3f4f6', text: '#6b7280' },
}

export default function SessionsPage() {
  const sessions = MOCK_SESSIONS

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>場次管理</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>今日所有球館場次</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}>
          <option>所有球館</option>
          {MOCK_VENUES.map(v => <option key={v.id}>{v.name}</option>)}
        </select>
        <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}>
          <option>所有類型</option>
          <option>新手場</option>
          <option>中階場</option>
          <option>進階場</option>
          <option>混合場</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {sessions.map(session => (
          <a key={session.id} href={`/sessions/${session.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
              padding: '16px 20px', display: 'flex', alignItems: 'center',
              gap: 16, cursor: 'pointer', flexWrap: 'wrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#aaa')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e6e0')}
            >
              <div style={{ textAlign: 'center', minWidth: 52 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{session.startTime}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{session.endTime}</div>
              </div>

              <div style={{ width: 1, height: 36, background: '#f0ede6' }} />

              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{session.venueName}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 8,
                    background: SESSION_TYPE_COLOR[session.sessionType].bg,
                    color: SESSION_TYPE_COLOR[session.sessionType].text,
                  }}>
                    {SESSION_TYPE_LABEL[session.sessionType]}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#f5f4f0', color: '#666' }}>
                    {NET_HEIGHT_LABEL[session.netHeight]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {session.court ?? '主場地'} · 上限 {session.maxCapacity} 人
                </div>
              </div>

              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {session.currentCount}
                  <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400 }}>/{session.maxCapacity}</span>
                </div>
                <div style={{ marginTop: 4, background: '#f0ede6', borderRadius: 4, height: 4, width: 80 }}>
                  <div style={{
                    height: 4, borderRadius: 4,
                    width: `${((session.currentCount ?? 0) / session.maxCapacity) * 100}%`,
                    background: (session.currentCount ?? 0) >= session.maxCapacity ? '#e85d3a' : '#10b981',
                  }} />
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 60 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>${session.price}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>/ 人</div>
              </div>

              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 8, fontWeight: 500,
                background: STATUS_COLOR[session.status].bg,
                color: STATUS_COLOR[session.status].text,
              }}>
                {STATUS_LABEL[session.status]}
              </span>

              <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
