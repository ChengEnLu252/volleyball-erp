'use client'

// ============================================================
// components/AiSummaryTeaser.tsx — Dashboard 底部精簡 AI 卡
// ============================================================
// 取代原本完整版的 AiSection。Dashboard 改成只露出最高優先級的
// 1 條洞察 + 數量提示 + 跳轉按鈕。完整版在 /ai-summary 頁面。
// ============================================================

import type { AiInsight } from '@/data/api'
import { COLORS, FONTS } from './theme/tokens'

type Props = {
  insights: AiInsight[]
}

export default function AiSummaryTeaser({ insights }: Props) {
  const top = insights[0]
  const moreCount = Math.max(insights.length - 1, 0)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: '0 2px 8px -3px rgba(255,45,138,0.08)',
      position: 'relative',
    }}>
      {/* HUD 角 */}
      <span style={{ position:'absolute', top:-1, left:-1, width:8, height:8, borderTop:`1.5px solid ${COLORS.pink500}`, borderLeft:`1.5px solid ${COLORS.pink500}` }} />
      <span style={{ position:'absolute', top:-1, right:-1, width:8, height:8, borderTop:`1.5px solid ${COLORS.pink500}`, borderRight:`1.5px solid ${COLORS.pink500}` }} />
      <span style={{ position:'absolute', bottom:-1, left:-1, width:8, height:8, borderBottom:`1.5px solid ${COLORS.pink500}`, borderLeft:`1.5px solid ${COLORS.pink500}` }} />
      <span style={{ position:'absolute', bottom:-1, right:-1, width:8, height:8, borderBottom:`1.5px solid ${COLORS.pink500}`, borderRight:`1.5px solid ${COLORS.pink500}` }} />

      <div style={{
        padding: '13px 16px',
        borderBottom: `1px solid ${COLORS.pink100}`,
        background: `linear-gradient(90deg, ${COLORS.pink50} 0%, #fff 80%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink900 }}>
            AI 營運摘要
          </div>
          <span className="vop-mono" style={{
            fontSize: 9, color: COLORS.pink700,
            background: COLORS.pink100,
            padding: '2px 7px', borderRadius: 99,
            fontWeight: 800, letterSpacing: '0.08em',
            border: `1px solid ${COLORS.pink200}`,
          }}>
            NEW
          </span>
        </div>
        <a href="/ai-summary" style={{
          fontSize: 12, padding: '6px 14px',
          borderRadius: 9, border: 'none',
          background: `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
          color: '#fff', textDecoration: 'none',
          fontWeight: 800,
          boxShadow: '0 4px 12px -2px rgba(255,45,138,0.45)',
          letterSpacing: '0.02em',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          查看完整分析 <span style={{ fontSize: 14 }}>→</span>
        </a>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {top ? (
          <>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 9,
              background: top.bg,
              fontWeight: 600,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{top.icon}</span>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6, fontWeight: 600 }}>
                {top.text}
              </div>
            </div>
            {moreCount > 0 && (
              <div className="vop-mono" style={{
                marginTop: 8,
                fontSize: 11,
                color: COLORS.ink500,
                fontWeight: 700,
                fontFamily: FONTS.mono,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 5, height: 5, borderRadius: '50%',
                  background: COLORS.pink500,
                }} />
                還有 {moreCount} 條觀察 · 6 項 AI 分析模組 · AI 對話助理
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: '14px', fontSize: 13, color: COLORS.ink500,
            textAlign: 'center', fontWeight: 600,
          }}>
            目前一切正常,沒有異常觀察 — 點上方按鈕看更多 AI 分析模組。
          </div>
        )}
      </div>
    </div>
  )
}
