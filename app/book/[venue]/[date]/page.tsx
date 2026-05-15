'use client'

// ============================================================
// app/book/[venue]/[date]/page.tsx — 該日場次清單
// ============================================================
// 階段 13 改寫。
//
// 結構：
//   1. Header (BookingShell)
//   2. 日期標題（5 月 15 日 星期五）
//   3. LoginGate 包住場次列表（時間軸 layout）
// ============================================================

import { use, useMemo } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getVenueBySlug, listSessionsByVenueAndDate } from '@/data/api'
import BookingShell from '@/components/booking/BookingShell'
import SessionCard from '@/components/booking/SessionCard'
import LoginGate from '@/components/booking/LoginGate'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
} from '@/components/booking/theme'

const WEEK_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function formatDateChinese(dateStr: string): { main: string; sub: string } {
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
      {/* 日期標題卡 */}
      <section style={{
        background: BOOKING_COLORS.bgCard,
        border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
        borderRadius: BOOKING_RADIUS.card,
        padding: '16px 18px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 4px 14px rgba(255, 107, 157, 0.10)',
      }}>
        <Link
          href={`/book/${venue}`}
          aria-label="回月曆"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: BOOKING_COLORS.pinkSoft,
            color: BOOKING_COLORS.pinkVividDeep,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ‹
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: BOOKING_FONTS.display,
            fontSize: 22,
            fontWeight: 700,
            color: BOOKING_COLORS.textPrimary,
            letterSpacing: '-0.3px',
            lineHeight: 1.1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            {main}
            <span style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: BOOKING_COLORS.textSecondary,
              letterSpacing: 1,
            }}>
              {sub}
            </span>
          </div>
          <div style={{
            marginTop: 4,
            fontSize: 11.5,
            color: BOOKING_COLORS.textMuted,
            letterSpacing: 0.5,
          }}>
            {sessions.length === 0 ? '本日無場次' : `共 ${sessions.length} 場可選`}
          </div>
        </div>
      </section>

      {/* 排球場次 tab indicator（裝飾） */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingLeft: 4,
      }}>
        <span style={{
          padding: '4px 12px',
          borderRadius: BOOKING_RADIUS.pill,
          background: BOOKING_COLORS.pinkSoft,
          color: BOOKING_COLORS.pinkVividDeep,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
        }}>
          🏐 排球場次
        </span>
      </div>

      {/* 場次列表 — 包 LoginGate */}
      <LoginGate
        reason="登入後才能查看當日場次與報名喔～"
        ctaLabel="使用 LINE 登入查看場次"
      >
        {sessions.length > 0 ? (
          <div style={{ display: 'grid', gap: 18 }}>
            {sessions.map((s, idx) => (
              <SessionCard
                key={s.id}
                venueSlug={venue}
                session={s}
                isLast={idx === sessions.length - 1}
              />
            ))}
          </div>
        ) : (
          <EmptyState venueSlug={venue} />
        )}
      </LoginGate>
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
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>🌸</div>
      <div style={{
        fontFamily: BOOKING_FONTS.display,
        fontSize: 17,
        fontWeight: 700,
        color: BOOKING_COLORS.textPrimary,
        marginBottom: 8,
      }}>
        本日尚無開放場次
      </div>
      <div style={{
        fontSize: 13,
        color: BOOKING_COLORS.textSecondary,
        lineHeight: 1.7,
        marginBottom: 18,
      }}>
        請選擇其他日期，或加入官方 LINE 詢問加開可能性
      </div>
      <Link href={`/book/${venueSlug}`} style={{
        display: 'inline-block',
        padding: '10px 24px',
        borderRadius: 999,
        background: BOOKING_COLORS.pinkSoft,
        color: BOOKING_COLORS.pinkVividDeep,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
      }}>
        ← 回月曆
      </Link>
    </div>
  )
}
