'use client'

// ============================================================
// app/book/[venue]/me/page.tsx — 我的預定頁
// ============================================================
// 階段 13 新增。
//
// 顯示登入用戶：
//   1. 即將場次（status='registered'，未來日期）— 可取消
//   2. 歷史場次（status='completed' / 'cancelled'）— 唯讀
//
// 取消規則：開場前 24H 內不可自行取消（舊系統規則）
// ============================================================

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getVenueBySlug } from '@/data/api'
import BookingShell from '@/components/booking/BookingShell'
import LoginGate from '@/components/booking/LoginGate'
import { getLineUser, type LineUser } from '@/components/booking/LineLoginModal'
import {
  listUpcomingBookings, listHistoryBookings, cancelMyBooking, canCancelBooking,
  type MyBookingItem,
} from '@/data/my-bookings'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
  SESSION_TYPE_LABEL, SESSION_TYPE_TAG_COLOR,
} from '@/components/booking/theme'

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const PAY_METHOD_LABEL: Record<MyBookingItem['payMethod'], string> = {
  cash: '現場付現',
  linepay: 'LINE Pay',
  transfer: '銀行轉帳',
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${WEEK_LABELS[date.getDay()]}）`
}

export default function MyBookingsPage({ params }: {
  params: Promise<{ venue: string }>
}) {
  const { venue } = use(params)
  const venueInfo = getVenueBySlug(venue)
  if (!venueInfo) notFound()

  return (
    <BookingShell venueSlug={venue} venueInfo={venueInfo}>
      <LoginGate
        reason="登入後才能查看您的報名紀錄喔～"
        ctaLabel="使用 LINE 登入查看"
      >
        <MyBookingsContent venueSlug={venue} />
      </LoginGate>
    </BookingShell>
  )
}

// ─────────────────────────────────────────────────────────────
// 主內容（已登入）
// ─────────────────────────────────────────────────────────────
function MyBookingsContent({ venueSlug }: { venueSlug: string }) {
  const [user, setUser] = useState<LineUser | null>(null)
  const [upcoming, setUpcoming] = useState<MyBookingItem[]>([])
  const [history, setHistory] = useState<MyBookingItem[]>([])
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    const u = getLineUser()
    setUser(u)
    if (u) {
      setUpcoming(listUpcomingBookings(u.userId))
      setHistory(listHistoryBookings(u.userId))
    }
  }, [reloadTick])

  function handleCancel(bookingId: string) {
    if (!user) return
    const ok = window.confirm('確定要取消此場次嗎？取消後無法恢復。')
    if (!ok) return
    const success = cancelMyBooking(user.userId, bookingId)
    if (success) {
      setReloadTick(t => t + 1)
    } else {
      window.alert('取消失敗，請再試一次或私訊官方帳號')
    }
  }

  if (!user) return null  // LoginGate 已處理

  return (
    <>
      {/* 頁標 */}
      <section style={{ marginBottom: 18 }}>
        <h1 style={{
          fontFamily: BOOKING_FONTS.display,
          fontSize: 24,
          fontWeight: 700,
          margin: 0,
          color: BOOKING_COLORS.textPrimary,
          letterSpacing: '-0.3px',
        }}>
          我的預定場次
        </h1>
        <div style={{
          fontSize: 12.5,
          color: BOOKING_COLORS.textSecondary,
          marginTop: 6,
        }}>
          👤 {user.displayName} 的報名紀錄
        </div>
      </section>

      {/* Tab 切換 */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        borderBottom: `1px solid ${BOOKING_COLORS.borderLight}`,
        paddingBottom: 2,
      }}>
        <SubTab active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
          即將場次 {upcoming.length > 0 && <Badge count={upcoming.length} />}
        </SubTab>
        <SubTab active={tab === 'history'} onClick={() => setTab('history')}>
          歷史場次 {history.length > 0 && <Badge count={history.length} muted />}
        </SubTab>
      </div>

      {/* 內容 */}
      {tab === 'upcoming' ? (
        upcoming.length > 0 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {upcoming.map(b => (
              <BookingRow key={b.id} item={b} onCancel={() => handleCancel(b.id)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🏐"
            title="目前沒有預定的場次"
            desc="點上方「場次預定」去看看有什麼可報名的場次吧！"
            ctaLabel="前往場次預定"
            ctaHref={`/book/${venueSlug}`}
          />
        )
      ) : (
        history.length > 0 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {history.map(b => (
              <BookingRow key={b.id} item={b} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📭"
            title="尚未有歷史報名紀錄"
            desc="完成過的場次會出現在這裡。"
          />
        )
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 單筆 booking 列
// ─────────────────────────────────────────────────────────────
function BookingRow({ item, onCancel }: {
  item: MyBookingItem
  onCancel?: () => void
}) {
  const typeStyle = SESSION_TYPE_TAG_COLOR[item.sessionType]
    ?? { bg: BOOKING_COLORS.bgSecondary, text: BOOKING_COLORS.textSecondary }
  const cancellable = onCancel && canCancelBooking(item)

  // 狀態顯示
  let statusBadge: { label: string; bg: string; color: string } | null = null
  if (item.status === 'registered') {
    statusBadge = item.isWaitlist
      ? { label: '候補中', bg: BOOKING_COLORS.bgSecondary, color: BOOKING_COLORS.textSecondary }
      : { label: '已報名', bg: BOOKING_COLORS.okBg, color: BOOKING_COLORS.ok }
  } else if (item.status === 'completed') {
    statusBadge = { label: '已完成', bg: BOOKING_COLORS.bgSecondary, color: BOOKING_COLORS.textMuted }
  } else if (item.status === 'cancelled') {
    statusBadge = { label: '已取消', bg: BOOKING_COLORS.warnBg, color: BOOKING_COLORS.warn }
  }

  return (
    <article style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      border: `1px solid ${BOOKING_COLORS.borderLight}`,
      padding: '16px 18px',
      boxShadow: '0 1px 3px rgba(184, 100, 130, 0.04), 0 6px 16px rgba(184, 100, 130, 0.04)',
      opacity: item.status === 'cancelled' ? 0.68 : 1,
    }}>
      {/* 第一列：日期 + 狀態 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          fontFamily: BOOKING_FONTS.display,
          fontSize: 16,
          fontWeight: 700,
          color: BOOKING_COLORS.textPrimary,
          letterSpacing: '-0.3px',
          flex: 1,
        }}>
          {formatDate(item.sessionDate)}
        </div>
        {statusBadge && (
          <span style={{
            fontSize: 11,
            padding: '3px 9px',
            borderRadius: BOOKING_RADIUS.pill,
            background: statusBadge.bg,
            color: statusBadge.color,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}>
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* 時間 */}
      <div style={{
        fontFamily: BOOKING_FONTS.num,
        fontSize: 18,
        fontWeight: 700,
        color: BOOKING_COLORS.pinkVividDeep,
        marginBottom: 8,
      }}>
        {item.startTime} – {item.endTime}
      </div>

      {/* 型態 tag + 館名 */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <span style={{
          fontSize: 10.5,
          padding: '2px 8px',
          borderRadius: BOOKING_RADIUS.pill,
          background: typeStyle.bg,
          color: typeStyle.text,
          fontWeight: 600,
        }}>
          {SESSION_TYPE_LABEL[item.sessionType] ?? item.sessionType}
        </span>
        <span style={{
          fontSize: 11,
          color: BOOKING_COLORS.textSecondary,
        }}>
          📍 {item.venueName}
        </span>
      </div>

      {/* 詳細資訊 */}
      <div style={{
        fontSize: 12,
        color: BOOKING_COLORS.textSecondary,
        lineHeight: 1.85,
        padding: '8px 10px',
        background: BOOKING_COLORS.bgSecondary,
        borderRadius: BOOKING_RADIUS.sm,
        marginBottom: onCancel ? 10 : 0,
      }}>
        <div>報名人：<strong style={{ color: BOOKING_COLORS.textPrimary }}>{item.registrantName}</strong></div>
        <div>費用：<strong style={{ color: BOOKING_COLORS.textPrimary }}>NT$ {item.totalFee}</strong></div>
        <div>付款：{PAY_METHOD_LABEL[item.payMethod]}</div>
      </div>

      {/* 取消按鈕 */}
      {onCancel && (
        <>
          {cancellable && cancellable.ok ? (
            <button
              onClick={onCancel}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: 4,
                background: 'transparent',
                color: BOOKING_COLORS.warn,
                border: `1px solid ${BOOKING_COLORS.warnBg}`,
                borderRadius: BOOKING_RADIUS.md,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              取消此場次報名
            </button>
          ) : cancellable && !cancellable.ok ? (
            <div style={{
              fontSize: 11.5,
              color: BOOKING_COLORS.textMuted,
              padding: '8px 10px',
              background: '#fffbef',
              border: '1px solid #f4e1a3',
              borderRadius: BOOKING_RADIUS.sm,
              marginTop: 4,
              lineHeight: 1.6,
            }}>
              ⚠️ {cancellable.reason}
            </div>
          ) : null}
        </>
      )}
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// 小元件
// ─────────────────────────────────────────────────────────────
function SubTab({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? `2.5px solid ${BOOKING_COLORS.pinkVivid}` : '2.5px solid transparent',
        color: active ? BOOKING_COLORS.pinkVividDeep : BOOKING_COLORS.textSecondary,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        marginBottom: -1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  )
}

function Badge({ count, muted }: { count: number; muted?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 6px',
      borderRadius: 999,
      background: muted ? BOOKING_COLORS.borderLight : BOOKING_COLORS.pinkVivid,
      color: muted ? BOOKING_COLORS.textMuted : '#fff',
      fontSize: 10.5,
      fontWeight: 700,
    }}>
      {count}
    </span>
  )
}

function EmptyState({ icon, title, desc, ctaLabel, ctaHref }: {
  icon: string; title: string; desc: string
  ctaLabel?: string; ctaHref?: string
}) {
  return (
    <div style={{
      padding: '50px 24px',
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      border: `1px dashed ${BOOKING_COLORS.pinkBorder}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{
        fontFamily: BOOKING_FONTS.display,
        fontSize: 16,
        fontWeight: 700,
        color: BOOKING_COLORS.textPrimary,
        marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 12.5,
        color: BOOKING_COLORS.textSecondary,
        lineHeight: 1.7,
        marginBottom: ctaLabel ? 16 : 0,
      }}>
        {desc}
      </div>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} style={{
          display: 'inline-block',
          padding: '10px 22px',
          borderRadius: 999,
          background: BOOKING_COLORS.pinkSoft,
          color: BOOKING_COLORS.pinkVividDeep,
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: 'none',
          border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
        }}>
          {ctaLabel} →
        </Link>
      )}
    </div>
  )
}
