'use client'

// ============================================================
// components/booking/RulesSection.tsx — 摺疊式規則區
// ============================================================
// 階段 13 新增。
//
// 顯示 6 個摺疊章節，預設全收合（與舊系統一致）：
//   1. 球場相關守則
//   2. 報名須知（含 LINE 連結，由 venueInfo 注入）
//   3. 取消報名以及候補補位機制
//   4. 包場價格及流程
//   5. 公務損壞之賠償
//   6. 車輛停放規定
//
// 視覺：白底卡 → 內含 6 個摺疊列。
// 點 header 展開/收合，箭頭旋轉。所有 user（不分登入）都可看。
// ============================================================

import { useState } from 'react'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'
import {
  CourtRules,
  RegistrationNotice,
  CancelPolicy,
  RentalInfo,
  DamageCompensation,
  ParkingRules,
} from './rules-content'
import type { PublicVenueInfo } from '@/data/api'

interface Props {
  venueInfo: PublicVenueInfo
  venueSlug: string
  /** 初始展開哪一章（不填則全收合） */
  defaultOpenIndex?: number
}

interface Chapter {
  emoji: string
  title: string
  content: React.ReactNode
}

export default function RulesSection({ venueInfo, venueSlug, defaultOpenIndex }: Props) {
  // 6 章節（每章內容是 React node，可塞 LINE 連結變數等）
  const chapters: Chapter[] = [
    { emoji: '🏐', title: '球場相關守則', content: <CourtRules /> },
    { emoji: '🏐', title: '報名須知', content: <RegistrationNotice venueInfo={venueInfo} /> },
    { emoji: '🏐', title: '取消報名以及候補補位機制', content: <CancelPolicy /> },
    { emoji: '🏐', title: '包場價格及流程', content: <RentalInfo venueSlug={venueSlug} /> },
    { emoji: '🏐', title: '公務損壞之賠償', content: <DamageCompensation /> },
    { emoji: '🏐', title: '車輛停放規定', content: <ParkingRules venueSlug={venueSlug} /> },
  ]

  return (
    <section style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      border: `1px solid ${BOOKING_COLORS.borderLight}`,
      padding: '22px 22px 6px',
      boxShadow: '0 1px 3px rgba(184, 100, 130, 0.04), 0 6px 18px rgba(184, 100, 130, 0.04)',
    }}>
      <h2 style={{
        fontFamily: BOOKING_FONTS.display,
        fontSize: 17,
        fontWeight: 700,
        margin: '0 0 14px',
        color: BOOKING_COLORS.textPrimary,
        letterSpacing: '-0.3px',
      }}>
        報名前詳閱以下規定
      </h2>

      {chapters.map((c, i) => (
        <RuleAccordion
          key={c.title}
          emoji={c.emoji}
          title={c.title}
          defaultOpen={defaultOpenIndex === i}
        >
          {c.content}
        </RuleAccordion>
      ))}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// 單一摺疊列
// ─────────────────────────────────────────────────────────────
function RuleAccordion({
  emoji, title, children, defaultOpen,
}: {
  emoji: string; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)

  return (
    <div style={{
      borderTop: `1px solid ${BOOKING_COLORS.borderLight}`,
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%',
          padding: '14px 2px',
          display: 'flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: BOOKING_COLORS.textPrimary,
          fontSize: 14.5,
          fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <span style={{ marginRight: 8, fontSize: 16 }}>{emoji}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{
          fontSize: 14,
          color: BOOKING_COLORS.pinkVividDeep,
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform .2s',
          marginLeft: 8,
          fontWeight: 700,
        }}>
          ›
        </span>
      </button>
      {open && (
        <div style={{
          padding: '4px 2px 18px',
          animation: 'rulesFadeIn .3s ease-out',
        }}>
          {children}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rulesFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}
