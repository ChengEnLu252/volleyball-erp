'use client'

// ============================================================
// app/book/[venue]/[date]/page.tsx — 該日場次清單
// ============================================================
// 階段 12 新增。
// 流程：用戶從月曆點某日 → 進到此頁，看當日所有場次卡 → 選一場進入報名。
// ============================================================

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import { getVenueBySlug, listSessionsByVenueAndDate } from '@/data/api'
import BookingShell from '@/components/booking/BookingShell'
import SessionCard from '@/components/booking/SessionCard'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from '@/components/booking/theme'

const WEEK_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function formatDateChinese(dateStr: string): { main: string; sub: string } {
  // dateStr = YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return {
    main: `${m} 月 ${d} 日`,
    sub: WEEK_LABELS[date.getDay()]!,
  }
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export default function DayBookPage({ params }: {
  params: Promise<{ venue: string; date: string }>
}) {
  const { venue, date } = use(params)
  const venueInfo = getVenueBySlug(venue)
  if (!venueInfo) notFound()
  if (!isValidDate(date)) notFound()

  const sessions = useMemo(
    () => listSessionsByVenueAndDate(venueInfo.id, date),
    [venueInfo.id, date],
  )
  const { main, sub } = formatDateChinese(date)

  return (
    <BookingShell
      venueSlug={venue}
      venueInfo={venueInfo}
      breadcrumb={`${main} ${sub}`}
    >
      {/* 日期標題 */}
      <section style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: BOOKING_FONTS.display, fontSize: 30, fontWeight: 700,
          color: BOOKING_COLORS.textPrimary, letterSpacing: '-0.5px',
          lineHeight: 1.1,
        }}>
          {main}
          <span style={{
            marginLeft: 12, fontSize: 14, fontWeight: 500,
            color: BOOKING_COLORS.textSecondary, letterSpacing: 1,
          }}>
            {sub}
          </span>
        </div>
        <div style={{
          marginTop: 8, fontSize: 12, color: BOOKING_COLORS.textMuted, letterSpacing: 1,
        }}>
          {sessions.length === 0 ? '本日無場次' : `共 ${sessions.length} 場可選`}
        </div>
      </section>

      {/* 場次清單 */}
      {sessions.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {sessions.map(s => (
            <SessionCard key={s.id} venueSlug={venue} session={s} />
          ))}
        </div>
      ) : (
        <EmptyState venueSlug={venue} />
      )}
    </BookingShell>
  )
}


function EmptyState({ venueSlug }: { venueSlug: string }) {
  return (
    <div style={{
      padding: '60px 24px',
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      border: `1px dashed ${BOOKING_COLORS.pinkBorder}`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 36, marginBottom: 12,
        opacity: 0.5,
      }}>
        🌸
      </div>
      <div style={{
        fontFamily: BOOKING_FONTS.display, fontSize: 17, fontWeight: 700,
        color: BOOKING_COLORS.textPrimary, marginBottom: 8,
      }}>
        本日尚無開放場次
      </div>
      <div style={{
        fontSize: 13, color: BOOKING_COLORS.textSecondary, lineHeight: 1.7,
        marginBottom: 18,
      }}>
        請選擇其他日期，或加入官方 LINE 詢問加開可能性
      </div>
      <a href={`/book/${venueSlug}`} style={{
        display: 'inline-block', padding: '10px 24px', borderRadius: 999,
        background: BOOKING_COLORS.pinkSoft, color: BOOKING_COLORS.pinkDeep,
        fontSize: 13, fontWeight: 600, textDecoration: 'none',
        border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
      }}>
        ← 回月曆
      </a>
    </div>
  )
}
