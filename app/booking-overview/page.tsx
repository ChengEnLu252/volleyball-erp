'use client'

// ============================================================
// app/booking-overview/page.tsx — 報名熱度看板（階段 12）
// ============================================================
// 給館長 / 老闆一站式看「未來兩週 × 各館 × 各場次」的報名彙整。
//
// 設計：
//   - 上方：館切換 tab（依視角過濾 — owner 看全部、manager 看自己館）
//   - 主區：選中館的「未來 14 天」按日卡片，每卡片內列出該日所有場次
//   - 每場次顯示：時間 / 型態 / 場地 / 程度 / 容量熱度 / 預計收入
//   - 點任一場次 → 跳轉到 /sessions/[id] 看完整報名人清單
//
// 與既有 /sessions 不同處：
//   - /sessions 是「以時段排序的場次列表」
//   - /booking-overview 是「以館 + 日聚合的看板」，更像 dashboard
//
// 視覺維持 ERP 配色（奶白 + 白卡），不走粉色 — 粉色是客戶端報名頁專用。
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { PublicSession } from '@/data/api'
import { loadBookingOverviewAction, type BookingOverviewBundle } from '@/app/actions/booking-overview'

const SESSION_TYPE_LABEL: Record<string, string> = {
  male_only: '男純', male_mixed: '男混', male_position: '男專位',
  female_only: '女純', female_mixed: '女混', female_position: '女專位',
  rental: '包場',
}

const SESSION_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  male_only:       { bg: '#dbeafe', text: '#1e40af' },
  male_mixed:      { bg: '#ede9fe', text: '#5b21b6' },
  male_position:   { bg: '#e0f2fe', text: '#0369a1' },
  female_only:     { bg: '#fce7f3', text: '#9d174d' },
  female_mixed:    { bg: '#fdf2f8', text: '#a21caf' },
  female_position: { bg: '#fdf4ff', text: '#7e22ce' },
  rental:          { bg: '#f0fdf4', text: '#166534' },
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(dateStr: string): { md: string; dow: string; isToday: boolean; isWeekend: boolean } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return {
    md: `${m}/${d}`,
    dow: WEEK_LABELS[date.getDay()]!,
    isToday: date.toDateString() === today.toDateString(),
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
  }
}

export default function BookingOverviewPage() {
  // P-booking-read：熱度看板改查真 DB（client 自取 server action，已 scope）
  const [bundle, setBundle] = useState<BookingOverviewBundle | null>(null)
  function load(venueId?: string) {
    loadBookingOverviewAction({ venueId }).then(setBundle)
  }
  useEffect(() => { load() }, [])

  const ok = bundle?.ok ? bundle : null
  const venues = ok?.venues ?? []
  const selectedVenueId = ok?.venueId ?? null
  const setSelectedVenueId = (id: string) => load(id)
  const overview = ok?.overview ?? null

  const overallFillPct = overview && overview.totalCapacity > 0
    ? Math.round((overview.totalRegistrations / overview.totalCapacity) * 100)
    : 0

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>報名熱度</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
          各館未來兩週每日場次的報名狀態彙整
        </p>
      </div>

      {/* 館切換 tabs */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap',
        background: '#fff', borderRadius: 12, padding: 6,
        border: '1px solid #e8e6e0',
      }}>
        {venues.map(v => (
          <button
            key={v.id}
            onClick={() => setSelectedVenueId(v.id)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: selectedVenueId === v.id ? '#1a1917' : 'transparent',
              color: selectedVenueId === v.id ? '#fff' : '#555',
              fontSize: 13, fontWeight: selectedVenueId === v.id ? 600 : 500,
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* 彙整統計 */}
      {overview && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          marginBottom: 22,
        }}>
          <StatCard label="場次總數" value={`${overview.totalSessions}`} suffix="場" />
          <StatCard label="已報名" value={`${overview.totalRegistrations}`} suffix="人" color="#1e40af" />
          <StatCard label="剩餘名額" value={`${overview.totalRemainingSeats}`} suffix="位" color="#10b981" />
          <StatCard label="整體熱度" value={`${overallFillPct}%`}
            color={overallFillPct >= 80 ? '#e85d3a' : overallFillPct >= 50 ? '#d97706' : '#10b981'} />
        </div>
      )}

      {/* 按日卡片 */}
      {overview && overview.byDate.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {overview.byDate.map(({ date, sessions }) => (
            <DayCard key={date} date={date} sessions={sessions} />
          ))}
        </div>
      ) : overview ? (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '60px 24px',
          textAlign: 'center', color: '#888', border: '1px dashed #d1c8c1',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>未來兩週本館尚無場次</div>
          <div style={{ fontSize: 12, color: '#aaa' }}>
            可至「場次管理」<Link href="/sessions/new" style={{ color: '#5b4fd8' }}>新增場次</Link>
          </div>
        </div>
      ) : (
        <div style={{ padding: 40, color: '#888' }}>選擇一個球館以查看報名熱度</div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatCard({ label, value, suffix, color }: {
  label: string; value: string; suffix?: string; color?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, lineHeight: 1, color: color ?? '#1a1917',
      }}>
        {value}
        {suffix && <span style={{ fontSize: 12, color: '#aaa', fontWeight: 500, marginLeft: 3 }}>{suffix}</span>}
      </div>
    </div>
  )
}


function DayCard({ date, sessions }: { date: string; sessions: PublicSession[] }) {
  const { md, dow, isToday, isWeekend } = formatDate(date)
  const totalReg = sessions.reduce((s, x) => s + x.currentCount, 0)
  const totalCap = sessions.reduce((s, x) => s + x.maxCapacity, 0)
  const totalIncome = sessions.reduce((s, x) =>
    s + x.currentCount * (x.courtFee + (x.acEnabled ? x.acFee : 0)), 0)
  const pct = totalCap > 0 ? (totalReg / totalCap) * 100 : 0

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
      overflow: 'hidden',
    }}>
      {/* Day header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px', borderBottom: '1px solid #f0ede6',
        background: isToday ? '#fdf2f8' : '#fafaf8',
      }}>
        <div style={{
          textAlign: 'center', minWidth: 56,
          padding: '6px 0',
          borderRadius: 10,
          background: isToday ? '#1a1917' : 'transparent',
          color: isToday ? '#fff' : (isWeekend ? '#9d174d' : '#1a1917'),
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{md}</div>
          <div style={{ fontSize: 10, marginTop: 3, opacity: isToday ? 0.85 : 0.6 }}>{dow}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {sessions.length} 場
            <span style={{ fontWeight: 400, color: '#888', marginLeft: 8 }}>
              · {totalReg}/{totalCap} 人 · 預計收入 ${totalIncome.toLocaleString()}
            </span>
          </div>
          <div style={{
            marginTop: 6, height: 6, background: '#f0ede6', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct >= 100 ? '#e85d3a' : pct >= 80 ? '#d97706' : pct >= 50 ? '#10b981' : '#94d3a2',
              transition: 'width .3s',
            }} />
          </div>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: pct >= 100 ? '#e85d3a' : pct >= 80 ? '#d97706' : '#166534',
        }}>
          {Math.round(pct)}%
        </div>
      </div>

      {/* Sessions */}
      <div>
        {sessions.map((s, i) => <SessionRow key={s.id} session={s} divider={i > 0} />)}
      </div>
    </div>
  )
}


function SessionRow({ session, divider }: { session: PublicSession; divider: boolean }) {
  const fillPct = (session.currentCount / session.maxCapacity) * 100
  const isFull = session.currentCount >= session.maxCapacity
  const totalPerSeat = session.courtFee + (session.acEnabled ? session.acFee : 0)
  const income = session.currentCount * totalPerSeat
  const typeStyle = SESSION_TYPE_COLOR[session.sessionType] ?? { bg: '#f5f4f0', text: '#666' }

  return (
    <Link href={`/sessions/${session.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 20px',
          borderTop: divider ? '1px solid #f5f4f0' : 'none',
          cursor: 'pointer',
          transition: 'background .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#fafaf8')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ minWidth: 70, fontSize: 13, fontWeight: 600 }}>
          {session.startTime}
          <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 2 }}>
            –{session.endTime.slice(0, 5)}
          </span>
        </div>

        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 6,
          background: typeStyle.bg, color: typeStyle.text, fontWeight: 600,
        }}>
          {SESSION_TYPE_LABEL[session.sessionType] ?? session.sessionType}
        </span>

        {session.court && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 6,
            background: '#f5f4f0', color: '#666',
          }}>
            {session.court}
          </span>
        )}

        {session.hasAircon && session.acEnabled && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 6,
            background: '#e8f4fa', color: '#386576', fontWeight: 600,
          }}>
            ❄︎冷
          </span>
        )}

        <div style={{ flex: 1, minWidth: 60 }}>
          {(session.minSkillRequired || session.maxSkillAllowed) && (
            <div style={{ fontSize: 11, color: '#888' }}>
              程度 {session.minSkillRequired ?? '?'} – {session.maxSkillAllowed ?? '?'}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', minWidth: 100 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: isFull ? '#e85d3a' : '#1a1917',
          }}>
            {session.currentCount}/{session.maxCapacity}
          </div>
          <div style={{
            marginTop: 3, height: 4, background: '#f0ede6', borderRadius: 4, overflow: 'hidden', width: 90, marginLeft: 'auto',
          }}>
            <div style={{
              height: '100%', width: `${Math.min(100, fillPct)}%`,
              background: fillPct >= 100 ? '#e85d3a' : fillPct >= 80 ? '#d97706' : '#10b981',
            }} />
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
            ${income.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>
            ${totalPerSeat}/人
          </div>
        </div>

        <span style={{ color: '#ccc', fontSize: 16 }}>›</span>
      </div>
    </Link>
  )
}
