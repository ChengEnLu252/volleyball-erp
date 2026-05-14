'use client'

// ============================================================
// app/book/[venue]/page.tsx — 報名頁首頁（月曆）
// ============================================================
// 階段 12 改寫。
// 流程：用戶進站 → 看品牌 hero + 月曆 → 選日期 → 跳轉到該日場次清單。
// ============================================================

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import { getVenueBySlug, listBookingDatesWithSessions } from '@/data/api'
import BookingShell from '@/components/booking/BookingShell'
import BookingCalendar from '@/components/booking/BookingCalendar'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from '@/components/booking/theme'

function today(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function VenueBookHome({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = use(params)
  const venueInfo = getVenueBySlug(venue)
  if (!venueInfo) notFound()

  const todayStr = today()
  // 階段 12：
  //   - BOOKING_OPEN_DAYS = 開放報名的窗口（一般館長只開未來兩週的場次）
  //   - CALENDAR_VIEW_DAYS = 月曆可瀏覽範圍（一整年，讓用戶能往後翻看後續月份）
  //     兩週外的日期在月曆會顯示為 disabled (沒場次)，但格子仍可見
  const BOOKING_OPEN_DAYS = 14
  const CALENDAR_VIEW_DAYS = 365

  const dates = useMemo(
    () => listBookingDatesWithSessions(venueInfo.id, todayStr, BOOKING_OPEN_DAYS),
    [venueInfo.id, todayStr],
  )

  const totalSessions = dates.reduce((s, d) => s + d.sessionCount, 0)
  const totalOpenSessions = dates.reduce((s, d) => s + d.openSessionCount, 0)
  const totalRemainingSeats = dates.reduce((s, d) => s + d.remainingSeats, 0)

  // 月曆翻月上限：今日 +365 天（讓月曆能看到後續一整年）
  const maxDate = useMemo(() => {
    const d = new Date(todayStr + 'T00:00:00')
    d.setDate(d.getDate() + CALENDAR_VIEW_DAYS)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [todayStr])

  return (
    <BookingShell venueSlug={venue} venueInfo={venueInfo} hero>
      {/* 報名狀況概覽（hero 下方的浮卡） */}
      <section style={{
        marginTop: 24, marginBottom: 32,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
      }}>
        <StatCard label="未來兩週" value={`${totalSessions}`} suffix="場" />
        <StatCard label="可報名場次" value={`${totalOpenSessions}`} suffix="場" highlight />
        <StatCard label="剩餘名額" value={`${totalRemainingSeats}`} suffix="位" />
      </section>

      <BookingCalendar venueSlug={venue} availableDates={dates} maxDate={maxDate} />

      {/* 注意事項 */}
      <section style={{
        marginTop: 28,
        padding: '22px 24px',
        background: BOOKING_COLORS.bgCard,
        borderRadius: BOOKING_RADIUS.card,
        border: `1px solid ${BOOKING_COLORS.borderLight}`,
      }}>
        <h3 style={{
          fontFamily: BOOKING_FONTS.display, fontSize: 16, fontWeight: 700,
          margin: '0 0 12px', color: BOOKING_COLORS.textPrimary,
        }}>
          報名須知
        </h3>
        <ul style={{
          margin: 0, paddingLeft: 18, lineHeight: 1.9,
          fontSize: 13, color: BOOKING_COLORS.textSecondary,
        }}>
          <li>報名前請以 LINE 登入，以利身份確認</li>
          <li>付款方式：現場付現、現場 LINE Pay、現場銀行轉帳</li>
          <li>場次費用為球費，冷氣費依當日是否開冷氣另計</li>
          <li>取消規則：開場前 12 小時可免費取消；12 小時內取消需自行找替補，否則影響後續報名資格</li>
          <li>程度自評若與實際落差過大，館長有權拒絕入場</li>
        </ul>
      </section>
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
      padding: '14px 14px 12px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10.5, color: highlight ? BOOKING_COLORS.pinkDarker : BOOKING_COLORS.textMuted,
        marginBottom: 6, letterSpacing: 1, fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: BOOKING_FONTS.num, fontSize: 20, fontWeight: 700,
        color: highlight ? BOOKING_COLORS.pinkDarker : BOOKING_COLORS.textPrimary,
        lineHeight: 1,
      }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, color: BOOKING_COLORS.textMuted }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
