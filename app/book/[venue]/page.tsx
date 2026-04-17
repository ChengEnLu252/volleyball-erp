'use client'

import { use } from 'react'
import { VENUE_BY_SLUG, MOCK_PUBLIC_SESSIONS } from '@/data/mock'

const SESSION_TYPE_LABEL: Record<string, string> = {
  male_only: '男網純男', male_mixed: '男網混排', male_position: '男網專位',
  female_only: '女網純女', female_mixed: '女網混排', female_position: '女網專位',
  rental: '包場',
}
const SESSION_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  male_only:       { bg: '#dbeafe', text: '#1e40af' },
  male_mixed:      { bg: '#ede9fe', text: '#5b21b6' },
  male_position:   { bg: '#e0f2fe', text: '#0369a1' },
  female_only:     { bg: '#fce7f3', text: '#9d174d' },
  female_mixed:    { bg: '#fdf2f8', text: '#a21caf' },
  female_position: { bg: '#fdf4ff', text: '#7e22ce' },
  rental:          { bg: '#dcfce7', text: '#166534' },
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const days = ['日','一','二','三','四','五','六']
  return `${d.getMonth()+1}/${d.getDate()}（${days[d.getDay()]}）`
}

export default function VenueBookPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = use(params)
  const venueInfo = VENUE_BY_SLUG[venue]
  if (!venueInfo) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>找不到此球館</div>

  const sessions = MOCK_PUBLIC_SESSIONS.filter(s => s.venueId === venueInfo.id)
  const grouped = sessions.reduce((acc, s) => {
    if (!acc[s.sessionDate]) acc[s.sessionDate] = []
    acc[s.sessionDate].push(s)
    return acc
  }, {} as Record<string, typeof sessions>)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0' }}>
      <div style={{ background: '#1a1917', color: '#fff', padding: '20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>VolleyOps 報名系統</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{venueInfo.name}</h1>
          <div style={{ fontSize: 13, color: '#aaa' }}>{venueInfo.address}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <a href={`/book/${venue}/rental`} style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 8,
              background: '#d4a843', color: '#1a1917', textDecoration: 'none', fontWeight: 600,
            }}>📦 查詢包場時段</a>
            <a href={`/book/${venue}/cancel`} style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,.1)', color: '#ccc', textDecoration: 'none',
            }}>取消報名</a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        {Object.entries(grouped).map(([date, daySessions]) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              {formatDate(date)}
              {date === today && <span style={{ fontSize: 10, background: '#1a1917', color: '#d4a843', padding: '1px 7px', borderRadius: 6 }}>今日</span>}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {daySessions.map(session => {
                const isFull = session.currentCount >= session.maxCapacity
                const remaining = session.maxCapacity - session.currentCount
                const fillPct = (session.currentCount / session.maxCapacity) * 100
                return (
                  <div key={session.id} style={{
                    background: '#fff', borderRadius: 14, padding: '16px 18px',
                    border: `1px solid ${isFull ? '#fca5a5' : '#e8e6e0'}`,
                    opacity: isFull ? 0.85 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ textAlign: 'center', minWidth: 52 }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{session.startTime}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>–{session.endTime}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 8, background: SESSION_TYPE_COLOR[session.sessionType].bg, color: SESSION_TYPE_COLOR[session.sessionType].text, fontWeight: 500 }}>
                            {SESSION_TYPE_LABEL[session.sessionType]}
                          </span>
                          {session.minSkillRequired && (
                            <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 8, background: '#f5f4f0', color: '#555' }}>
                              {session.minSkillRequired} 以上
                            </span>
                          )}
                        </div>
                        {session.notes && <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{session.notes}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, background: '#f0ede6', borderRadius: 4, height: 5 }}>
                            <div style={{ height: 5, borderRadius: 4, width: `${fillPct}%`, background: isFull ? '#e85d3a' : fillPct > 70 ? '#f59e0b' : '#10b981' }} />
                          </div>
                          <span style={{ fontSize: 12, color: isFull ? '#e85d3a' : '#555', fontWeight: isFull ? 600 : 400, whiteSpace: 'nowrap' }}>
                            {isFull ? '已額滿' : `剩 ${remaining} 位`}（{session.currentCount}/{session.maxCapacity}）
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>${session.price}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>/ 人</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                      {isFull ? (
                        <a href={`/book/${venue}/${session.id}?waitlist=true`} style={{
                          flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10,
                          background: '#f5f4f0', color: '#555', textDecoration: 'none', fontSize: 14, fontWeight: 600,
                        }}>候補報名</a>
                      ) : (
                        <a href={`/book/${venue}/${session.id}`} style={{
                          flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10,
                          background: '#1a1917', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600,
                        }}>立即報名</a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
