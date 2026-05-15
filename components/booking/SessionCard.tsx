'use client'

// ============================================================
// components/booking/SessionCard.tsx
// ============================================================
// 階段 13 改寫：左圓點時間軸 layout + 舊系統簡潔文字風格。
//
// Layout：
//   ┌──────┬─────────────────────────────┐
//   │  ●   │  09:00 - 12:00              │
//   │  │   │  ┌─────────────────────────┐│
//   │  │   │  │ <活動描述>              ││
//   │  │   │  │ 招募 18 人，空調 +45    ││
//   │  │   │  │ 費用：180 元 ❄          ││
//   │  │   │  │ 已報名: 5, 候補: 0      ││
//   │  │   │  │            [報名按鈕]   ││
//   │  │   │  └─────────────────────────┘│
//   └──────┴─────────────────────────────┘
//
// 列表外層用 grid + gap，時間軸線靠 SessionTimelineWrapper 串起。
// 此元件本身只負責「左圓點 + 右卡片」，不畫整條軸線（軸線靠 CSS 連結相鄰卡）。
// ============================================================

import Link from 'next/link'
import { useState } from 'react'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
  SESSION_TYPE_LABEL, SESSION_TYPE_TAG_COLOR,
  SKILL_DESCRIPTIONS,
} from './theme'
import type { PublicSession } from '@/data/api'

interface Props {
  venueSlug: string
  session: PublicSession
  /** 該卡是否為列表的最後一張（控制下方時間軸延伸線是否要畫） */
  isLast?: boolean
}

export default function SessionCard({ venueSlug, session, isLast }: Props) {
  const isFull = session.status === 'full'
  const isCancelled = session.status === 'cancelled'
  const remaining = Math.max(0, session.maxCapacity - session.currentCount)
  const totalPriceWithAc = session.courtFee + (session.hasAircon ? session.acFee : 0)

  const typeStyle = SESSION_TYPE_TAG_COLOR[session.sessionType]
    ?? { bg: BOOKING_COLORS.bgSecondary, text: BOOKING_COLORS.textSecondary }

  // 活動描述（程度 + 型態）
  let descLine = SESSION_TYPE_LABEL[session.sessionType] ?? session.sessionType
  if (session.minSkillRequired || session.maxSkillAllowed) {
    let levelText = ''
    if (session.minSkillRequired && !session.maxSkillAllowed) levelText = `${session.minSkillRequired} 以上`
    else if (!session.minSkillRequired && session.maxSkillAllowed) levelText = `${session.maxSkillAllowed} 以下`
    else levelText = `${session.minSkillRequired}~${session.maxSkillAllowed}`
    descLine = `${descLine} 程度 ${levelText}`
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '50px 1fr',
      gap: 0,
      position: 'relative',
    }}>
      {/* 左：時間軸圓點 + 連接線 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: BOOKING_COLORS.pinkVivid,
          border: `2px solid ${BOOKING_COLORS.bgPrimary}`,
          boxShadow: `0 0 0 2px ${BOOKING_COLORS.pinkBorder}`,
          flexShrink: 0,
          zIndex: 2,
        }} />
        {!isLast && (
          <div style={{
            flex: 1,
            width: 2,
            background: BOOKING_COLORS.pinkBorder,
            marginTop: 4,
            marginBottom: -14,   /* 蓋過下一個 grid 的 gap，跨到下一張卡 */
          }} />
        )}
      </div>

      {/* 右：卡片 */}
      <article style={{
        opacity: isCancelled ? 0.55 : 1,
      }}>
        {/* 時間 (卡片外，左對齊) */}
        <div style={{
          fontFamily: BOOKING_FONTS.num,
          fontSize: 15,
          fontWeight: 600,
          color: BOOKING_COLORS.textPrimary,
          marginBottom: 6,
          marginLeft: 2,
        }}>
          {session.startTime} – {session.endTime}
        </div>

        <div style={{
          background: BOOKING_COLORS.bgCard,
          borderRadius: BOOKING_RADIUS.card,
          border: `1px solid ${BOOKING_COLORS.borderLight}`,
          padding: '14px 16px 14px',
          boxShadow: '0 1px 3px rgba(184, 100, 130, 0.05), 0 4px 14px rgba(184, 100, 130, 0.04)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          {/* 左：場次資訊 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 型態 + 冷氣 tag */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              <span style={{
                fontSize: 10.5,
                padding: '2px 8px',
                borderRadius: BOOKING_RADIUS.pill,
                background: typeStyle.bg,
                color: typeStyle.text,
                fontWeight: 600,
              }}>
                {SESSION_TYPE_LABEL[session.sessionType] ?? session.sessionType}
              </span>
              {session.court && (
                <span style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: BOOKING_RADIUS.pill,
                  background: BOOKING_COLORS.bgSecondary,
                  color: BOOKING_COLORS.textSecondary,
                }}>
                  {session.court}
                </span>
              )}
              {session.hasAircon && (
                <span style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: BOOKING_RADIUS.pill,
                  background: BOOKING_COLORS.airconBg,
                  color: BOOKING_COLORS.aircon,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  ❄︎ 開冷氣
                </span>
              )}
            </div>

            {/* 活動描述（含程度） */}
            <SkillTooltipLine descLine={descLine} />

            {/* 招募 + 費用 + 已報名/候補 */}
            <div style={{
              fontSize: 12.5,
              color: BOOKING_COLORS.textSecondary,
              lineHeight: 1.85,
              marginTop: 6,
            }}>
              <div>
                招募 <strong style={{ color: BOOKING_COLORS.textPrimary }}>{session.maxCapacity}</strong> 人
                {session.hasAircon && (
                  <span style={{ color: BOOKING_COLORS.aircon, marginLeft: 6 }}>
                    ，空調 +{session.acFee}
                  </span>
                )}
              </div>
              <div>
                費用：<strong style={{ color: BOOKING_COLORS.pinkVividDeep, fontSize: 13 }}>
                  {totalPriceWithAc} 元
                </strong>
              </div>
              <div>
                已報名: <strong style={{ color: BOOKING_COLORS.textPrimary }}>{session.currentCount}</strong>
                ，候補: <strong style={{ color: BOOKING_COLORS.textPrimary }}>0</strong>
              </div>
            </div>

            {session.notes && (
              <p style={{
                margin: '10px 0 0',
                padding: '8px 10px',
                borderRadius: BOOKING_RADIUS.sm,
                fontSize: 11.5,
                color: BOOKING_COLORS.textSecondary,
                lineHeight: 1.6,
                background: BOOKING_COLORS.bgSecondary,
                borderLeft: `3px solid ${BOOKING_COLORS.pinkBorder}`,
              }}>
                {session.notes}
              </p>
            )}
          </div>

          {/* 右：報名按鈕 */}
          <CTA
            venueSlug={venueSlug}
            session={session}
            isFull={isFull}
            isCancelled={isCancelled}
            remaining={remaining}
          />
        </div>
      </article>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 程度說明 tooltip
// ─────────────────────────────────────────────────────────────
function SkillTooltipLine({ descLine }: { descLine: string }) {
  const [showTip, setShowTip] = useState(false)

  return (
    <div style={{
      fontFamily: BOOKING_FONTS.display,
      fontSize: 13.5,
      fontWeight: 600,
      color: BOOKING_COLORS.textPrimary,
      lineHeight: 1.45,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    }}>
      <span>{descLine}</span>
      <button
        onClick={(e) => { e.preventDefault(); setShowTip(!showTip) }}
        aria-label="程度等級說明"
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
          background: 'transparent',
          color: BOOKING_COLORS.pinkVividDeep,
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          position: 'relative',
        }}
      >
        ?
        {showTip && (
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute',
            top: 22,
            left: -8,
            zIndex: 20,
            background: BOOKING_COLORS.bgCard,
            border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
            borderRadius: BOOKING_RADIUS.md,
            padding: '12px 14px',
            width: 220,
            fontSize: 11.5,
            color: BOOKING_COLORS.textSecondary,
            fontWeight: 400,
            lineHeight: 1.8,
            textAlign: 'left',
            boxShadow: '0 8px 24px rgba(184, 100, 130, 0.18)',
          }}>
            <div style={{ fontWeight: 700, color: BOOKING_COLORS.textPrimary, marginBottom: 6 }}>
              程度等級對照
            </div>
            {Object.entries(SKILL_DESCRIPTIONS).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 2 }}>{v}</div>
            ))}
          </div>
        )}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CTA — 報名按鈕
// ─────────────────────────────────────────────────────────────
function CTA({
  venueSlug, session, isFull, isCancelled, remaining,
}: {
  venueSlug: string
  session: PublicSession
  isFull: boolean
  isCancelled: boolean
  remaining: number
}) {
  if (isCancelled) {
    return (
      <span style={{
        padding: '8px 14px',
        borderRadius: BOOKING_RADIUS.md,
        background: BOOKING_COLORS.bgSecondary,
        color: BOOKING_COLORS.textMuted,
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}>
        已取消
      </span>
    )
  }

  const href = isFull
    ? `/book/${venueSlug}/${session.sessionDate}/${session.id}?waitlist=true`
    : `/book/${venueSlug}/${session.sessionDate}/${session.id}`

  return (
    <Link
      href={href}
      style={{
        padding: '9px 16px',
        borderRadius: BOOKING_RADIUS.md,
        background: isFull
          ? BOOKING_COLORS.pinkSoft
          : `linear-gradient(135deg, ${BOOKING_COLORS.pinkDeep}, ${BOOKING_COLORS.pinkVivid})`,
        color: isFull ? BOOKING_COLORS.pinkVividDeep : '#fff',
        fontSize: 13,
        fontWeight: 700,
        textDecoration: 'none',
        boxShadow: isFull ? 'none' : '0 4px 12px rgba(255, 107, 157, 0.32)',
        letterSpacing: 1,
        flexShrink: 0,
        alignSelf: 'flex-start',
        border: isFull ? `1px solid ${BOOKING_COLORS.pinkBorder}` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {isFull ? '候補' : '報名'}
    </Link>
  )
}
