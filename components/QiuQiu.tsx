'use client'

// ============================================================
// components/QiuQiu.tsx — 球球 ◌ VolleyOps 吉祥物
// ============================================================
// Q 版排球擬人化角色。手繪線條風 + 清楚的臉（不被球面紋路擋）
// + 完整身體 + 87 號粉色球衣。
//
// variants:
//   - full    : 全身（dashboard hero、AI 提醒區）
//   - mini    : sidebar watermark（半透明簡化版）
//   - face    : 只有頭（小頭像 / inline 行內）
//
// Tips:
//   球面三條線刻意做成「淡 + 細 + 半透明」(opacity 0.65)
//   完全不擋眼睛 / 嘴 / 腮紅，所以表情永遠 100% 清楚。
// ============================================================

import { COLORS } from './theme/tokens'

interface Props {
  /** SVG 寬度（px） */
  size?: number
  /** 樣式 variant */
  variant?: 'full' | 'mini' | 'face'
  /** 旋轉角度（度） */
  rotate?: number
  /** 整體透明度 */
  opacity?: number
  /** 球衣號碼 */
  number?: number
  /** 是否啟用上下浮動動畫 */
  bob?: boolean
  /** 自訂 style 補強 */
  style?: React.CSSProperties
}

export default function QiuQiu({
  size = 96,
  variant = 'full',
  rotate = 0,
  opacity = 1,
  number = 87,
  bob = false,
  style,
}: Props) {
  if (variant === 'face') {
    return <QiuQiuFace size={size} opacity={opacity} style={style} />
  }

  const w = size
  const h = (size / 120) * 145
  const stroke = variant === 'mini' ? '#5d4858' : COLORS.ink900
  const strokeWidth = variant === 'mini' ? 2.4 : 2.8
  const lineColor = '#b58496'

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 120 145"
      style={{
        transform: `rotate(${rotate}deg)`,
        opacity,
        flexShrink: 0,
        ...(bob ? { animation: 'vop-bob 4s ease-in-out infinite' } : {}),
        ...style,
      }}
    >
      {/* —— 排球頭 —— */}
      <circle cx="60" cy="50" r="34" fill="#fff" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />

      {/* —— 球面紋路（極淡，不擋臉）—— */}
      <path d="M 60 16 Q 46 50 60 84" stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M 60 16 Q 74 50 60 84" stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M 26 50 Q 60 36 94 50" stroke={lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55" />

      {/* —— 大眼睛 —— */}
      <ellipse cx="47" cy="47" rx="4.8" ry="6.2" fill={stroke} />
      <ellipse cx="73" cy="47" rx="4.8" ry="6.2" fill={stroke} />
      {/* 反光 */}
      <circle cx="48.6" cy="44.4" r="2" fill="#fff" />
      <circle cx="74.6" cy="44.4" r="2" fill="#fff" />
      <circle cx="46" cy="50.2" r="1" fill="#fff" />
      <circle cx="72" cy="50.2" r="1" fill="#fff" />

      {/* —— 嘴 + 小舌頭 —— */}
      <path d="M 51 62 Q 60 70 69 62" stroke={stroke} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 56 64 Q 60 67.5 64 64 L 60 64 Z" fill="#ff5fa3" />

      {/* —— 大腮紅 —— */}
      <ellipse cx="40" cy="60" rx="5" ry="3" fill="#ffb8d1" opacity="0.9" />
      <ellipse cx="80" cy="60" rx="5" ry="3" fill="#ffb8d1" opacity="0.9" />

      {variant === 'full' && (
        <>
          {/* 動感放射線 */}
          <path d="M 26 22 L 32 24 M 22 34 L 28 34 M 94 22 L 88 24 M 98 34 L 92 34"
                stroke={COLORS.pink500} strokeWidth="1.6" fill="none" strokeLinecap="round" />

          {/* 球衣 */}
          <path d="M 50 86 L 44 110 L 76 110 L 70 86 Z" fill={COLORS.pink500} stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
          {/* 領口 */}
          <path d="M 50 86 Q 60 90 70 86" stroke={stroke} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {/* 號碼 — 預設 87 */}
          <text x="60" y="103.5" fontSize="10.5" fontWeight="800" fill="#fff" textAnchor="middle"
                fontFamily="'JetBrains Mono', ui-monospace, monospace" letterSpacing="-0.4">{number}</text>

          {/* 雙手舉起（cheering pose）*/}
          <path d="M 46 90 Q 30 76 24 88" stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="22" cy="88" r="4" fill="#fff" stroke={stroke} strokeWidth="2.4" />
          <path d="M 74 90 Q 90 76 96 88" stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="98" cy="88" r="4" fill="#fff" stroke={stroke} strokeWidth="2.4" />

          {/* 腿 + 鞋 */}
          <path d="M 53 110 L 50 126" stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 67 110 L 70 126" stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="48" cy="130" rx="7" ry="3" fill="#fff" stroke={stroke} strokeWidth="2.4" />
          <ellipse cx="72" cy="130" rx="7" ry="3" fill="#fff" stroke={stroke} strokeWidth="2.4" />
          {/* 鞋上的小粉條 */}
          <path d="M 48 130 L 45 130" stroke={COLORS.pink500} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 72 130 L 75 130" stroke={COLORS.pink500} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {variant === 'mini' && (
        <>
          {/* 簡化版球衣（無號碼）*/}
          <path d="M 50 86 L 46 108 L 74 108 L 70 86 Z" fill={COLORS.pink500} stroke={stroke} strokeWidth="2.2"
                strokeLinejoin="round" opacity="0.85" />
          {/* 簡化雙腿 */}
          <path d="M 52 110 L 50 124 M 68 110 L 70 124" stroke={stroke} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// ============================================================
// QiuQiuFace — 只有頭，用於 inline 行內、AI 對話氣泡頭像、空狀態
// ============================================================
function QiuQiuFace({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ opacity, flexShrink: 0, ...style }}>
      <circle cx="40" cy="40" r="32" fill="#fff" stroke={COLORS.ink900} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M 40 8 Q 28 40 40 72" stroke="#b58496" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M 40 8 Q 52 40 40 72" stroke="#b58496" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M 8 40 Q 40 28 72 40" stroke="#b58496" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55" />
      <ellipse cx="29" cy="37" rx="4.2" ry="5.5" fill={COLORS.ink900} />
      <ellipse cx="51" cy="37" rx="4.2" ry="5.5" fill={COLORS.ink900} />
      <circle cx="30.4" cy="34.7" r="1.7" fill="#fff" />
      <circle cx="52.4" cy="34.7" r="1.7" fill="#fff" />
      <path d="M 32 51 Q 40 58 48 51" stroke={COLORS.ink900} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="22" cy="49" rx="4.2" ry="2.5" fill="#ffb8d1" opacity="0.9" />
      <ellipse cx="58" cy="49" rx="4.2" ry="2.5" fill="#ffb8d1" opacity="0.9" />
    </svg>
  )
}
