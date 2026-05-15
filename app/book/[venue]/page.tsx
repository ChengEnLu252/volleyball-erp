'use client'

// ============================================================
// app/book/[venue]/page.tsx — 報名頁首頁
// ============================================================
// 階段 13 改寫。
//
// 結構（由上到下）：
//   1. Header (BookingShell 內建：Logo + tab + 登入鈕)
//   2. 規則區 RulesSection（6 摺疊章，未登入也可看）
//   3. 日曆 BookingCalendar（包在 LoginGate 內，未登入需先登入）
//   4. Footer（BookingShell 內建：LINE 官方 CTA + 地址）
// ============================================================

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import { getVenueBySlug, listBookingDatesWithSessions } from '@/data/api'
import BookingShell from '@/components/booking/BookingShell'
import BookingCalendar from '@/components/booking/BookingCalendar'
import RulesSection from '@/components/booking/RulesSection'
import LoginGate from '@/components/booking/LoginGate'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
} from '@/components/booking/theme'

function today(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const BOOKING_HORIZON_DAYS = 14

export default function VenueBookHome({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = use(params)
  const venueInfo = getVenueBySlug(venue)
  if (!venueInfo) notFound()

  const todayStr = today()

  const dates = useMemo(
    () => listBookingDatesWithSessions(venueInfo.id, todayStr, BOOKING_HORIZON_DAYS),
    [venueInfo.id, todayStr],
  )

  const totalSessions = dates.reduce((s, d) => s + d.sessionCount, 0)
  const totalOpenSessions = dates.reduce((s, d) => s + d.openSessionCount, 0)
  const totalRemainingSeats = dates.reduce((s, d) => s + d.remainingSeats, 0)

  // 月曆的 maxDate：今日 + 14 天
  const maxDate = useMemo(() => {
    const d = new Date(todayStr + 'T00:00:00')
    d.setDate(d.getDate() + BOOKING_HORIZON_DAYS)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [todayStr])

  return (
    <BookingShell venueSlug={venue} venueInfo={venueInfo}>
      {/* 品牌小區塊：館名 + 副標 */}
      <section style={{
        textAlign: 'center',
        marginBottom: 22,
      }}>
        <div style={{
          fontSize: 11,
          letterSpacing: 4,
          color: BOOKING_COLORS.textMuted,
          fontWeight: 500,
          marginBottom: 8,
          textTransform: 'uppercase',
        }}>
          {venueInfo.brandSubtitle}
        </div>
        <h1 style={{
          fontFamily: BOOKING_FONTS.display,
          fontSize: 26,
          fontWeight: 700,
          margin: 0,
          letterSpacing: '-0.3px',
          color: BOOKING_COLORS.textPrimary,
        }}>
          {venueInfo.name}
        </h1>
        <div style={{
          fontSize: 12,
          color: BOOKING_COLORS.textSecondary,
          marginTop: 6,
        }}>
          📍 {venueInfo.address}
        </div>
      </section>

      {/* 規則區（所有人都可看） */}
      <RulesSection venueInfo={venueInfo} venueSlug={venue} />

      {/* 統計概覽（小） */}
      <section style={{
        marginTop: 24,
        marginBottom: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        <StatCard label="未來兩週" value={`${totalSessions}`} suffix="場" />
        <StatCard label="可報名" value={`${totalOpenSessions}`} suffix="場" highlight />
        <StatCard label="剩餘名額" value={`${totalRemainingSeats}`} suffix="位" />
      </section>

      {/* 日曆 — 登入閘門 */}
      <LoginGate
        reason="登入後才能查看可預訂日期與場次喔～"
        ctaLabel="使用 LINE 登入查看場次"
      >
        <BookingCalendar venueSlug={venue} availableDates={dates} maxDate={maxDate} />
      </LoginGate>
    </BookingShell>
  )
}

function StatCard({ label, value, suffix, highlight }: {
  label: string; value: string; suffix?: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? BOOKING_COLORS.pinkSoft : BOOKING_COLORS.bgCard,
      border: `1px solid ${highlight ? BOOKING_COLORS.pinkBorder : BOOKING_COLORS.borderLight}`,
      borderRadius: BOOKING_RADIUS.md,
      padding: '12px 8px 10px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10,
        color: highlight ? BOOKING_COLORS.pinkVividDeep : BOOKING_COLORS.textMuted,
        marginBottom: 4,
        letterSpacing: 0.5,
        fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: BOOKING_FONTS.num,
        fontSize: 18,
        fontWeight: 700,
        color: highlight ? BOOKING_COLORS.pinkVividDeep : BOOKING_COLORS.textPrimary,
        lineHeight: 1,
      }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 2, color: BOOKING_COLORS.textMuted }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
