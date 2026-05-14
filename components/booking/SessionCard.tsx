'use client'

// ============================================================
// components/booking/SessionCard.tsx
// ============================================================
// 單一場次卡片（當日場次清單頁用）。
// 顯示：時間 / 場次型態 / 程度 / 費用拆分（球費 + 冷氣）/
//      容量進度條 / 缺額 / 場地 / 備註 / 程度說明 tooltip 入口
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
}

export default function SessionCard({ venueSlug, session }: Props) {
  const isFull = session.status === 'full'
  const isCancelled = session.status === 'cancelled'
  const remaining = Math.max(0, session.maxCapacity - session.currentCount)
  const fillPct = Math.min(100, (session.currentCount / session.maxCapacity) * 100)
  const totalPriceWithAc = session.courtFee + (session.hasAircon ? session.acFee : 0)

  const typeStyle = SESSION_TYPE_TAG_COLOR[session.sessionType] ?? { bg: BOOKING_COLORS.bgSecondary, text: BOOKING_COLORS.textSecondary }

  return (
    <article style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      border: `1px solid ${isFull ? BOOKING_COLORS.borderLight : BOOKING_COLORS.borderLight}`,
      padding: '20px 22px 18px',
      opacity: isCancelled ? 0.5 : 1,
      boxShadow: '0 1px 3px rgba(184, 100, 130, 0.04), 0 6px 16px rgba(184, 100, 130, 0.04)',
      transition: 'box-shadow .15s',
    }}>

      {/* Top row：時間 + 型態 tag + 場地 */}
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontFamily: BOOKING_FONTS.display,
            fontSize: 22, fontWeight: 700, lineHeight: 1.1,
            color: BOOKING_COLORS.textPrimary,
            letterSpacing: '-0.5px',
          }}>
            {session.startTime}
          </div>
          <div style={{
            fontSize: 11, color: BOOKING_COLORS.textMuted,
            marginTop: 4, letterSpacing: 0.5,
          }}>
            – {session.endTime}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          }}>
            <span style={{
              fontSize: 11.5, padding: '3px 10px', borderRadius: BOOKING_RADIUS.pill,
              background: typeStyle.bg, color: typeStyle.text,
              fontWeight: 600, letterSpacing: 0.5,
            }}>
              {SESSION_TYPE_LABEL[session.sessionType] ?? session.sessionType}
            </span>
            {session.court && (
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: BOOKING_RADIUS.pill,
                background: BOOKING_COLORS.bgSecondary, color: BOOKING_COLORS.textSecondary,
              }}>
                {session.court}
              </span>
            )}
            {session.hasAircon && (
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: BOOKING_RADIUS.pill,
                background: BOOKING_COLORS.airconBg, color: BOOKING_COLORS.aircon,
                fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                ❄︎ 開冷氣
              </span>
            )}
          </div>
          <SkillRange min={session.minSkillRequired} max={session.maxSkillAllowed} />
        </div>
      </header>

      {/* 費用區塊 */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        background: BOOKING_COLORS.bgSecondary,
        borderRadius: BOOKING_RADIUS.md,
        padding: '12px 14px', marginBottom: 14,
      }}>
        <div>
          <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, marginBottom: 4 }}>每位費用</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 4,
            fontFamily: BOOKING_FONTS.num,
          }}>
            <span style={{ fontSize: 13, color: BOOKING_COLORS.textSecondary }}>$</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: BOOKING_COLORS.textPrimary }}>
              {session.courtFee}
            </span>
            {session.hasAircon && (
              <span style={{ fontSize: 12.5, color: BOOKING_COLORS.aircon, fontWeight: 500 }}>
                + ${session.acFee} 冷氣
              </span>
            )}
          </div>
        </div>
        {session.hasAircon && (
          <div style={{
            textAlign: 'right', fontSize: 11, color: BOOKING_COLORS.textMuted, lineHeight: 1.5,
          }}>
            合計 <span style={{
              fontWeight: 700, color: BOOKING_COLORS.textPrimary, fontSize: 14,
            }}>${totalPriceWithAc}</span>
          </div>
        )}
      </div>

      {/* 容量進度條 */}
      <div style={{ marginBottom: session.notes ? 12 : 16 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 12, color: BOOKING_COLORS.textSecondary }}>
            報名狀況
          </span>
          <span style={{
            fontSize: 12, color: isFull ? BOOKING_COLORS.warn : BOOKING_COLORS.textPrimary,
            fontWeight: 600, fontFamily: BOOKING_FONTS.num,
          }}>
            {isFull ? '已額滿' : `剩 ${remaining} 位`}
            <span style={{ color: BOOKING_COLORS.textMuted, fontWeight: 400, marginLeft: 6 }}>
              {session.currentCount}/{session.maxCapacity}
            </span>
          </span>
        </div>
        <div style={{
          height: 6, background: BOOKING_COLORS.borderLight,
          borderRadius: BOOKING_RADIUS.pill, overflow: 'hidden',
        }}>
          <div style={{
            width: `${fillPct}%`, height: '100%',
            background: isFull
              ? BOOKING_COLORS.warn
              : fillPct > 70
                ? BOOKING_COLORS.pinkDeep
                : BOOKING_COLORS.pink,
            transition: 'width .4s',
          }} />
        </div>
      </div>

      {session.notes && (
        <p style={{
          margin: '0 0 14px',
          padding: '8px 12px', borderRadius: BOOKING_RADIUS.sm,
          fontSize: 12, color: BOOKING_COLORS.textSecondary, lineHeight: 1.6,
          background: BOOKING_COLORS.bgSecondary,
          borderLeft: `3px solid ${BOOKING_COLORS.pinkBorder}`,
        }}>
          {session.notes}
        </p>
      )}

      {/* CTA */}
      <Link
        href={isFull
          ? `/book/${venueSlug}/${session.sessionDate}/${session.id}?waitlist=true`
          : `/book/${venueSlug}/${session.sessionDate}/${session.id}`}
        style={{
          display: 'block', textAlign: 'center',
          padding: '13px', borderRadius: BOOKING_RADIUS.md,
          background: isFull ? BOOKING_COLORS.bgSecondary : BOOKING_COLORS.pinkDeep,
          color: isFull ? BOOKING_COLORS.textSecondary : '#fff',
          fontSize: 14, fontWeight: 600,
          textDecoration: 'none',
          boxShadow: isFull ? 'none' : '0 4px 14px rgba(201, 116, 147, 0.28)',
          letterSpacing: 1,
        }}
      >
        {isFull ? '候補報名' : '我要報名'}
      </Link>
    </article>
  )
}


// ─────────────────────────────────────────────────────────────
// SkillRange — 顯示程度範圍 + tooltip
// ─────────────────────────────────────────────────────────────
function SkillRange({ min, max }: { min: string | null; max: string | null }) {
  const [showTip, setShowTip] = useState(false)

  let text: string
  if (!min && !max) text = '不限程度'
  else if (min && !max) text = `${min} 以上`
  else if (!min && max) text = `${max} 以下`
  else text = `${min} ~ ${max}`

  return (
    <div style={{
      marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: BOOKING_COLORS.textSecondary,
    }}>
      <span>程度 · {text}</span>
      <button
        onClick={(e) => { e.preventDefault(); setShowTip(!showTip) }}
        aria-label="程度等級說明"
        style={{
          width: 16, height: 16, borderRadius: '50%',
          border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
          background: 'transparent', color: BOOKING_COLORS.pinkDeep,
          fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0,
          lineHeight: 1, position: 'relative',
        }}
      >
        ?
        {showTip && (
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute', top: 22, left: -8, zIndex: 20,
            background: BOOKING_COLORS.bgCard,
            border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
            borderRadius: BOOKING_RADIUS.md,
            padding: '12px 14px',
            width: 220, fontSize: 11.5, color: BOOKING_COLORS.textSecondary,
            fontWeight: 400, lineHeight: 1.8, textAlign: 'left',
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
