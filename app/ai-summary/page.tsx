'use client'

// ============================================================
// app/ai-summary/page.tsx — AI 營運摘要完整頁
// ============================================================
// 從 dashboard 的「AI 區塊」拆出來、擴充為獨立大頁。
// 7 區塊 + 浮動 AI 對話按鈕：
//   1. 現有觀察清單     getAiInsights()
//   2. 異常檢測         getAnomalyDetections()
//   3. 智能定價建議     getPricingRecommendations()
//   4. 場次排程建議     getSchedulingRecommendations()
//   5. 客戶流失預警     getChurnRiskCustomers()
//   6. 主揪表現分析     getCaptainPerformanceAnalysis()
//   7. 週/月自動報告    getAutoReport('week' | 'month')
//
// 視覺風格沿用 dashboard：粉紅 HUD bracket、vop-mono 標籤、
// QiuQiu hero、四角 HUD 邊角光。
//
// 權限：LayoutGuard 已在 ChromeShell 套用，會依 pathToPageKey
// 把 '/ai-summary' map 到 PageKey 'ai-summary' 自動擋人，
// 不需在這裡額外包 RequireRole。
// ============================================================

import { useEffect, useState } from 'react'
import {
  getAiInsights,
  getAnomalyDetections,
  getPricingRecommendations,
  getSchedulingRecommendations,
  getChurnRiskCustomers,
  getCaptainPerformanceAnalysis,
  getAutoReport,
  type AiInsight,
  type AiAnomaly,
  type AiAnomalySeverity,
  type PricingRecommendation,
  type PricingAction,
  type SchedulingRecommendation,
  type ScheduleAction,
  type ChurnRiskCustomer,
  type ChurnRiskLevel,
  type CaptainAnalysisResult,
  type CaptainPerformanceRow,
  type AutoReport,
  type ReportPeriod,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import AiChatDialog from '@/components/AiChatDialog'
import QiuQiu from '@/components/QiuQiu'
import { COLORS, FONTS } from '@/components/theme/tokens'


// ============================================================
// 主元件
// ============================================================
export default function AiSummaryPage() {
  useStoreSync()

  const [mounted, setMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('week')

  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  // SSR 階段先擋著、避免水合不一致(資料皆從 client-only store 推導)
  if (!mounted) {
    return (
      <div style={{
        padding: 40, color: COLORS.ink500, fontSize: 14, fontFamily: FONTS.sans,
      }}>
        AI 摘要載入中…
      </div>
    )
  }

  const insights        = getAiInsights()
  const anomalies       = getAnomalyDetections()
  const pricingRecs     = getPricingRecommendations()
  const scheduleRecs    = getSchedulingRecommendations()
  const churnRisks      = getChurnRiskCustomers(15)
  const captainAnalysis = getCaptainPerformanceAnalysis()
  const report          = getAutoReport(reportPeriod)

  // 標題日期
  const todayLabel = new Date()
    .toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '.')
  const weekdayShort = ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date().getDay()]

  // 摘要計數
  const moduleCount =
    (insights.length > 0 ? 1 : 0)
    + (anomalies.length > 0 ? 1 : 0)
    + (pricingRecs.length > 0 ? 1 : 0)
    + (scheduleRecs.length > 0 ? 1 : 0)
    + (churnRisks.length > 0 ? 1 : 0)
    + (captainAnalysis.totalCaptains > 0 ? 1 : 0)
    + 1 // 自動報告永遠有

  return (
    <div style={{ padding: '16px', fontFamily: FONTS.sans, position: 'relative' }}>
      <style>{`
        @media (max-width: 768px) {
          .ai-wrap { padding-top: 64px !important; }
          .ai-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ai-two-col   { grid-template-columns: 1fr !important; }
          .ai-three-col { grid-template-columns: 1fr !important; }
          .ai-hero-volli { display: none !important; }
          .ai-fab { bottom: 20px !important; right: 20px !important; }
        }
      `}</style>

      <div className="ai-wrap" style={{ paddingTop: 0, position: 'relative' }}>

        {/* ────────── 標題區 + 球球 hero ────────── */}
        <div style={{
          marginBottom: 18, position: 'relative', paddingRight: 130,
        }}>
          <div className="vop-mono" style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 800,
            color: COLORS.pink700,
            letterSpacing: '0.16em',
            padding: '3px 10px',
            background: COLORS.pink100,
            border: `1px solid ${COLORS.pink300}`,
            borderRadius: 99,
            marginBottom: 8,
          }}>
            [ {todayLabel} · {weekdayShort} · AI MODULES ]
          </div>
          <h1 style={{
            fontSize: 24, fontWeight: 800, margin: 0,
            letterSpacing: '-0.025em', lineHeight: 1.2,
            color: COLORS.ink900,
          }}>
            🤖 AI 營運摘要{' '}
            <span style={{
              color: COLORS.pink500,
              textShadow: '0 0 18px rgba(255,45,138,0.35)',
              fontFamily: FONTS.mono,
              fontSize: 22,
            }}>
              / INSIGHTS ⚡
            </span>
          </h1>
          <p style={{
            fontSize: 13, color: COLORS.ink500, margin: '6px 0 0',
            lineHeight: 1.5,
          }}>
            {moduleCount} 項 AI 分析已就緒 ·
            <span style={{ color: COLORS.pink500, fontWeight: 700 }}> {anomalies.length} </span>
            條異常 ·
            <span style={{ color: COLORS.pink500, fontWeight: 700 }}> {churnRisks.filter(c => c.riskLevel === 'high').length} </span>
            位高流失風險顧客
          </p>

          <div className="ai-hero-volli" style={{
            position: 'absolute', top: -4, right: 0,
            pointerEvents: 'none',
          }}>
            <QiuQiu variant="full" size={108} rotate={6} bob />
          </div>
        </div>

        {/* ────────── 區塊 1：現有觀察清單 ────────── */}
        <Panel title="AI 觀察清單" subTitle="// OBSERVATIONS" badge={insights.length}>
          {insights.length === 0 ? (
            <EmptyState text="目前一切正常 · 球球沒發現異常" showMascot />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((it, i) => (
                <InsightRow key={i} insight={it} idx={i} />
              ))}
            </div>
          )}
        </Panel>

        {/* ────────── 區塊 2：異常檢測 ────────── */}
        <Panel
          title="異常檢測"
          subTitle="// ANOMALIES"
          badge={anomalies.length}
          liveIndicator={anomalies.some(a => a.severity === 'critical')}
        >
          {anomalies.length === 0 ? (
            <EmptyState text="無異常事件 · 系統運作正常" showMascot />
          ) : (
            <div className="ai-two-col" style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
            }}>
              {anomalies.map(a => <AnomalyCard key={a.id} anomaly={a} />)}
            </div>
          )}
        </Panel>

        {/* ────────── 區塊 3：智能定價建議 ────────── */}
        <Panel title="智能定價建議" subTitle="// DYNAMIC PRICING" badge={pricingRecs.length}>
          {pricingRecs.length === 0 ? (
            <EmptyState text="近 28 天樣本不足以給出定價建議" />
          ) : (
            <div className="ai-two-col" style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
            }}>
              {pricingRecs.slice(0, 10).map((p, i) => (
                <PricingCard key={`${p.venueId}-${p.timeSlotLabel}`} rec={p} idx={i} />
              ))}
            </div>
          )}
        </Panel>

        {/* ────────── 區塊 4:場次排程建議 ────────── */}
        <Panel title="場次排程建議" subTitle="// SCHEDULING" badge={scheduleRecs.length}>
          {scheduleRecs.length === 0 ? (
            <EmptyState text="近 28 天樣本不足以給出排程建議" />
          ) : (
            <div className="ai-three-col" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
            }}>
              {scheduleRecs.map(s => <ScheduleCard key={s.bucketLabel} rec={s} />)}
            </div>
          )}
        </Panel>

        {/* ────────── 區塊 5:客戶流失預警 ────────── */}
        <Panel
          title="客戶流失預警"
          subTitle="// CHURN RISK"
          badge={churnRisks.length}
        >
          {churnRisks.length === 0 ? (
            <EmptyState text="未發現流失風險顧客 · 黏性穩定" showMascot />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Header row */}
              <div className="vop-mono" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 70px 90px 70px 1.4fr',
                gap: 10,
                padding: '8px 4px',
                fontSize: 10, fontWeight: 800,
                color: COLORS.pink700,
                letterSpacing: '0.08em',
                borderBottom: `1px solid ${COLORS.pink200}`,
              }}>
                <span>顧客</span>
                <span style={{ textAlign: 'right' }}>累計</span>
                <span style={{ textAlign: 'right' }}>未到天數</span>
                <span style={{ textAlign: 'center' }}>風險</span>
                <span>建議行動</span>
              </div>
              {churnRisks.map(c => <ChurnRow key={c.customerId} customer={c} />)}
            </div>
          )}
        </Panel>

        {/* ────────── 區塊 6:主揪表現分析 ────────── */}
        <Panel
          title="主揪表現分析"
          subTitle="// CAPTAIN PERFORMANCE"
          badge={captainAnalysis.totalCaptains}
        >
          {captainAnalysis.totalCaptains === 0 ? (
            <EmptyState text="目前無進行中的季租單可分析" />
          ) : (
            <>
              {/* 洞察摘要 */}
              {captainAnalysis.insights.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  marginBottom: 12,
                  background: COLORS.pink50,
                  borderRadius: 9,
                  border: `1px solid ${COLORS.pink100}`,
                }}>
                  {captainAnalysis.insights.map((line, i) => (
                    <div key={i} style={{
                      fontSize: 12,
                      color: COLORS.ink900,
                      lineHeight: 1.6,
                      fontWeight: 600,
                      display: 'flex', gap: 6,
                    }}>
                      <span style={{ color: COLORS.pink500, fontWeight: 800 }}>›</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="ai-two-col" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              }}>
                <CaptainColumn
                  title="🏆 金牌主揪"
                  shortLabel="// TOP"
                  rows={captainAnalysis.topCaptains}
                  emptyText="本季尚無達到金牌標準的主揪"
                  accent={COLORS.success}
                />
                <CaptainColumn
                  title="⚠ 待加強主揪"
                  shortLabel="// UNDERPERFORM"
                  rows={captainAnalysis.underperforming}
                  emptyText="目前無低於期望的主揪表現"
                  accent={COLORS.pink600}
                />
              </div>
            </>
          )}
        </Panel>

        {/* ────────── 區塊 7:週/月自動報告 ────────── */}
        <Panel
          title="自動營運報告"
          subTitle="// AUTO REPORT"
          rightContent={
            <div style={{ display: 'flex', gap: 4 }}>
              <PeriodToggle
                active={reportPeriod === 'week'}
                onClick={() => setReportPeriod('week')}
                label="本週"
              />
              <PeriodToggle
                active={reportPeriod === 'month'}
                onClick={() => setReportPeriod('month')}
                label="本月"
              />
            </div>
          }
        >
          <ReportContent report={report} />
        </Panel>

        {/* 底部留白,避開 FAB */}
        <div style={{ height: 80 }} />
      </div>

      {/* ────────── 浮動「問 AI 助理」按鈕 ────────── */}
      <button
        className="ai-fab"
        onClick={() => setChatOpen(true)}
        style={{
          position: 'fixed',
          bottom: 28, right: 28,
          zIndex: 100,
          padding: '13px 20px',
          borderRadius: 99,
          border: 'none',
          background: `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 10px 32px -6px rgba(255,45,138,0.55), 0 0 0 1px rgba(255,45,138,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ fontSize: 16 }}>🤖</span>
        <span>問 AI 助理</span>
      </button>

      <AiChatDialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        sampleQuestions={[
          '「哪些時段建議調漲?」',
          '「哪幾位顧客流失風險最高?」',
          '「金牌主揪有哪幾位?」',
          '「本週營運報告重點是什麼?」',
        ]}
      />
    </div>
  )
}


// ============================================================
// 子元件:Panel (帶 bracket title + sub label + badge + 右側 slot)
// 與 dashboard 的 Panel 風格一致,但這裡新增 subTitle 與 rightContent
// ============================================================
function Panel({
  title, subTitle, children, liveIndicator, badge, rightContent,
}: {
  title: string
  subTitle?: string
  children: React.ReactNode
  liveIndicator?: boolean
  badge?: number
  rightContent?: React.ReactNode
}) {
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
      {/* 4 個 HUD 角 */}
      <span style={{ position:'absolute', top:-1, left:-1, width:8, height:8, borderTop:`1.5px solid ${COLORS.pink500}`, borderLeft:`1.5px solid ${COLORS.pink500}` }} />
      <span style={{ position:'absolute', top:-1, right:-1, width:8, height:8, borderTop:`1.5px solid ${COLORS.pink500}`, borderRight:`1.5px solid ${COLORS.pink500}` }} />
      <span style={{ position:'absolute', bottom:-1, left:-1, width:8, height:8, borderBottom:`1.5px solid ${COLORS.pink500}`, borderLeft:`1.5px solid ${COLORS.pink500}` }} />
      <span style={{ position:'absolute', bottom:-1, right:-1, width:8, height:8, borderBottom:`1.5px solid ${COLORS.pink500}`, borderRight:`1.5px solid ${COLORS.pink500}` }} />

      <div style={{
        padding: '11px 14px',
        borderBottom: `1px solid ${COLORS.pink100}`,
        background: `linear-gradient(90deg, ${COLORS.pink50} 0%, #fff 80%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="vop-mono" style={{ fontSize: 10, color: COLORS.pink500, fontWeight: 800 }}>[</span>
          <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.ink900, letterSpacing: '-0.01em' }}>
            {title}
          </div>
          <span className="vop-mono" style={{ fontSize: 10, color: COLORS.pink500, fontWeight: 800 }}>]</span>
          {subTitle && (
            <span className="vop-mono" style={{
              fontSize: 9, color: COLORS.ink300, fontWeight: 700,
              letterSpacing: '0.12em',
            }}>
              {subTitle}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {liveIndicator && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="vop-ping" style={{
                width: 6, height: 6, borderRadius: '50%',
                background: COLORS.pink500, display: 'inline-block',
                boxShadow: `0 0 8px ${COLORS.pink500}`,
              }} />
              <span className="vop-mono" style={{
                fontSize: 10, fontWeight: 800, color: COLORS.pink500,
                letterSpacing: '0.1em',
              }}>ALERT</span>
            </div>
          )}
          {typeof badge === 'number' && badge > 0 && (
            <span className="vop-mono" style={{
              fontSize: 10,
              background: `linear-gradient(90deg, ${COLORS.pink500}, ${COLORS.pink400})`,
              color: '#fff',
              padding: '2px 9px', borderRadius: 99, fontWeight: 800,
              boxShadow: `0 0 8px rgba(255,45,138,0.45)`,
            }}>
              {String(badge).padStart(2, '0')}
            </span>
          )}
          {rightContent}
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:EmptyState (球球 + 文字)
// ============================================================
function EmptyState({ text, showMascot }: { text: string; showMascot?: boolean }) {
  return (
    <div style={{
      padding: '20px 12px', textAlign: 'center',
      color: COLORS.ink500, fontSize: 13,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      fontWeight: 600,
    }}>
      {showMascot && <QiuQiu variant="face" size={44} opacity={0.7} />}
      <span>{text}</span>
    </div>
  )
}


// ============================================================
// 子元件:InsightRow (觀察清單)
// ============================================================
function InsightRow({ insight, idx }: { insight: AiInsight; idx: number }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 12px', borderRadius: 9,
      background: insight.bg,
    }}>
      <span className="vop-mono" style={{
        fontSize: 9, color: insight.color, fontWeight: 800,
        flexShrink: 0, paddingTop: 4,
      }}>
        #{String(idx + 1).padStart(2, '0')}
      </span>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{insight.icon}</span>
      <div style={{ fontSize: 13, color: COLORS.ink900, lineHeight: 1.6, fontWeight: 600 }}>
        {insight.text}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:AnomalyCard (異常檢測卡)
// ============================================================
function AnomalyCard({ anomaly }: { anomaly: AiAnomaly }) {
  const severityMeta: Record<AiAnomalySeverity, {
    label: string; color: string; bg: string; border: string; icon: string
  }> = {
    critical: { label: '嚴重', color: COLORS.pink700, bg: COLORS.dangerBg,  border: COLORS.pink300, icon: '🚨' },
    warning:  { label: '警告', color: COLORS.warn,    bg: COLORS.warnBg,    border: COLORS.warnBorder, icon: '⚠️' },
    info:     { label: '提示', color: COLORS.cyanDeep,bg: '#e0f9fb',        border: COLORS.cyanLight, icon: '💡' },
  }
  const m = severityMeta[anomaly.severity]

  return (
    <div style={{
      padding: '11px 13px',
      background: m.bg,
      border: `1px solid ${m.border}`,
      borderRadius: 9,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14 }}>{m.icon}</span>
        <span className="vop-mono" style={{
          fontSize: 9, fontWeight: 800, color: m.color,
          letterSpacing: '0.08em',
          padding: '1px 7px', borderRadius: 99,
          background: '#fff',
          border: `1px solid ${m.border}`,
        }}>
          {m.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.ink900 }}>
          {anomaly.venueName}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.ink900, lineHeight: 1.5, fontWeight: 600 }}>
        {anomaly.message}
      </div>
      <div style={{
        fontSize: 11.5, color: COLORS.ink700,
        lineHeight: 1.5,
        paddingTop: 5,
        borderTop: `1px dashed ${m.border}`,
        fontWeight: 500,
      }}>
        <span className="vop-mono" style={{
          fontSize: 9, color: m.color, fontWeight: 800,
          marginRight: 5, letterSpacing: '0.08em',
        }}>
          建議 ▸
        </span>
        {anomaly.suggestedAction}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:PricingCard (定價建議卡)
// ============================================================
function PricingCard({ rec, idx }: { rec: PricingRecommendation; idx: number }) {
  const actionMeta: Record<PricingAction, {
    label: string; color: string; bg: string; border: string; arrow: string
  }> = {
    increase: { label: '建議調漲', color: COLORS.success, bg: COLORS.successBg, border: '#a3e0c5', arrow: '↑' },
    decrease: { label: '建議調降', color: COLORS.pink700, bg: COLORS.dangerBg,  border: COLORS.pink300, arrow: '↓' },
    maintain: { label: '維持現價', color: COLORS.ink500,  bg: COLORS.surfaceTint, border: COLORS.border, arrow: '→' },
  }
  const m = actionMeta[rec.action]

  return (
    <div style={{
      padding: '12px 14px',
      background: '#fff',
      border: `1px solid ${m.border}`,
      borderRadius: 9,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 左側 accent 條 */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: m.color,
      }} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, flexWrap: 'wrap', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="vop-mono" style={{
            fontSize: 9, color: COLORS.pink500, fontWeight: 800,
          }}>
            #{String(idx + 1).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.ink900 }}>
            {rec.venueName}
          </span>
          <span className="vop-mono" style={{
            fontSize: 10, color: COLORS.ink500, fontWeight: 700,
            padding: '1px 6px', borderRadius: 4,
            background: COLORS.pink50,
            border: `1px solid ${COLORS.pink100}`,
          }}>
            {rec.timeSlotLabel}
          </span>
        </div>

        <span className="vop-mono" style={{
          fontSize: 10, fontWeight: 800, color: m.color,
          padding: '2px 8px', borderRadius: 99,
          background: m.bg,
          border: `1px solid ${m.border}`,
          letterSpacing: '0.04em',
        }}>
          {m.arrow} {m.label}
        </span>
      </div>

      {/* 價格對比 */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6,
      }}>
        <span className="vop-mono" style={{
          fontSize: 11, color: COLORS.ink500, textDecoration: rec.action !== 'maintain' ? 'line-through' : 'none',
          fontWeight: 700,
        }}>
          ${rec.avgCourtFee}
        </span>
        {rec.action !== 'maintain' && (
          <>
            <span style={{ fontSize: 11, color: m.color, fontWeight: 700 }}>{m.arrow}</span>
            <span className="vop-mono" style={{
              fontSize: 18, color: m.color, fontWeight: 800,
              letterSpacing: '-0.02em',
            }}>
              ${rec.suggestedPrice}
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        <span className="vop-mono" style={{
          fontSize: 10, color: COLORS.ink500, fontWeight: 700,
        }}>
          滿場 {rec.avgFillRate}% · {rec.sampleSize} 場
        </span>
      </div>

      <div style={{
        fontSize: 11.5, color: COLORS.ink700, lineHeight: 1.5,
        fontWeight: 500,
      }}>
        {rec.reasoning}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:ScheduleCard (排程建議卡)
// ============================================================
function ScheduleCard({ rec }: { rec: SchedulingRecommendation }) {
  const actionMeta: Record<ScheduleAction, {
    label: string; color: string; bg: string; border: string; icon: string
  }> = {
    open_more: { label: '加開場次', color: COLORS.success, bg: COLORS.successBg, border: '#a3e0c5', icon: '➕' },
    reduce:    { label: '減少場次', color: COLORS.pink700, bg: COLORS.dangerBg,  border: COLORS.pink300, icon: '➖' },
    keep:      { label: '維持',     color: COLORS.ink500,  bg: COLORS.surfaceTint, border: COLORS.border, icon: '✓' },
  }
  const m = actionMeta[rec.action]

  return (
    <div style={{
      padding: '12px 14px',
      background: m.bg,
      border: `1px solid ${m.border}`,
      borderRadius: 9,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink900 }}>
          {rec.bucketLabel}
        </span>
        <span className="vop-mono" style={{
          fontSize: 10, fontWeight: 800, color: m.color,
          padding: '2px 8px', borderRadius: 99,
          background: '#fff',
          border: `1px solid ${m.border}`,
        }}>
          {m.icon} {m.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <div>
          <div className="vop-mono" style={{ fontSize: 9, color: COLORS.ink500, fontWeight: 700 }}>滿場率</div>
          <div className="vop-mono" style={{
            fontSize: 18, fontWeight: 800,
            color: rec.avgFillRate >= 80 ? COLORS.success : rec.avgFillRate < 45 ? COLORS.pink700 : COLORS.ink900,
            letterSpacing: '-0.02em',
          }}>
            {rec.avgFillRate}%
          </div>
        </div>
        <div>
          <div className="vop-mono" style={{ fontSize: 9, color: COLORS.ink500, fontWeight: 700 }}>場數</div>
          <div className="vop-mono" style={{
            fontSize: 18, fontWeight: 800, color: COLORS.ink900,
            letterSpacing: '-0.02em',
          }}>
            {rec.sessionCount}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 11.5, color: COLORS.ink700, lineHeight: 1.5, fontWeight: 500,
        paddingTop: 6, borderTop: `1px dashed ${m.border}`,
      }}>
        {rec.reasoning}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:ChurnRow (流失預警單列)
// ============================================================
function ChurnRow({ customer }: { customer: ChurnRiskCustomer }) {
  const riskMeta: Record<ChurnRiskLevel, { label: string; color: string; bg: string }> = {
    high:   { label: '高',  color: '#fff',          bg: COLORS.pink600 },
    medium: { label: '中',  color: COLORS.warn,     bg: COLORS.warnBg },
    low:    { label: '低',  color: COLORS.cyanDeep, bg: COLORS.cyanLight },
  }
  const m = riskMeta[customer.riskLevel]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 70px 90px 70px 1.4fr',
      gap: 10, alignItems: 'center',
      padding: '10px 4px',
      borderBottom: `1px dashed ${COLORS.borderLight}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${COLORS.pink400} 0%, ${COLORS.pink500} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: '#fff',
          flexShrink: 0,
        }}>
          {customer.customerName[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: COLORS.ink900,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {customer.customerName}
          </div>
          <div className="vop-mono" style={{
            fontSize: 10, color: COLORS.ink500, fontWeight: 600, marginTop: 1,
          }}>
            最後 {customer.lastVisitDate?.slice(5) ?? '?'} · 均 {customer.avgGapDays}d
          </div>
        </div>
      </div>

      <span className="vop-mono" style={{
        fontSize: 12, fontWeight: 800, color: COLORS.ink900,
        textAlign: 'right',
      }}>
        {customer.lifetimeVisits} 次
      </span>

      <span className="vop-mono" style={{
        fontSize: 13, fontWeight: 800,
        color: customer.daysSinceLastVisit > 60 ? COLORS.pink600 : COLORS.ink900,
        textAlign: 'right',
      }}>
        {customer.daysSinceLastVisit}d
      </span>

      <div style={{ textAlign: 'center' }}>
        <span className="vop-mono" style={{
          fontSize: 10, fontWeight: 800,
          color: m.color, background: m.bg,
          padding: '3px 10px', borderRadius: 99,
          letterSpacing: '0.04em',
          display: 'inline-block',
        }}>
          {m.label}
        </span>
      </div>

      <div style={{
        fontSize: 11.5, color: COLORS.ink700, lineHeight: 1.5, fontWeight: 500,
      }}>
        {customer.suggestedAction}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:CaptainColumn (主揪 top/under 雙欄)
// ============================================================
function CaptainColumn({
  title, shortLabel, rows, emptyText, accent,
}: {
  title: string
  shortLabel: string
  rows: CaptainPerformanceRow[]
  emptyText: string
  accent: string
}) {
  return (
    <div style={{
      background: COLORS.surfaceTint,
      border: `1px solid ${COLORS.pink100}`,
      borderRadius: 9, padding: '10px 12px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottom: `1px solid ${COLORS.pink100}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink900 }}>
          {title}
        </div>
        <span className="vop-mono" style={{
          fontSize: 9, fontWeight: 800, color: accent,
          letterSpacing: '0.12em',
        }}>
          {shortLabel}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{
          padding: '14px 8px',
          textAlign: 'center',
          fontSize: 12, color: COLORS.ink500, fontWeight: 600,
        }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r, i) => (
            <CaptainRow key={`${r.captainPhone}-${i}`} row={r} accent={accent} />
          ))}
        </div>
      )}
    </div>
  )
}


function CaptainRow({ row, accent }: { row: CaptainPerformanceRow; accent: string }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: '#fff',
      borderRadius: 7,
      border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4, flexWrap: 'wrap', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.ink900 }}>
            {row.captainName}
          </span>
          <span className="vop-mono" style={{
            fontSize: 10, color: COLORS.ink500, fontWeight: 600,
          }}>
            · {row.venueName}
          </span>
        </div>
        <span className="vop-mono" style={{
          fontSize: 11, fontWeight: 800, color: accent,
        }}>
          {row.avgFillRate}%
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 8, fontSize: 10.5, color: COLORS.ink500,
        fontWeight: 600, marginBottom: 4,
      }}>
        <span className="vop-mono">{row.sessionsRun} 場</span>
        <span>·</span>
        <span className="vop-mono">繳款 {Math.round(row.paidRatio * 100)}%</span>
      </div>
      <div style={{ fontSize: 11, color: COLORS.ink700, lineHeight: 1.5, fontWeight: 500 }}>
        {row.note}
      </div>
    </div>
  )
}


// ============================================================
// 子元件:週/月切換 toggle
// ============================================================
function PeriodToggle({
  active, onClick, label,
}: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 7,
        border: `1px solid ${active ? COLORS.pink500 : COLORS.border}`,
        background: active
          ? `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`
          : '#fff',
        color: active ? '#fff' : COLORS.ink700,
        fontSize: 11.5,
        fontWeight: 800,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        boxShadow: active ? '0 2px 8px -2px rgba(255,45,138,0.4)' : 'none',
      }}
    >
      {label}
    </button>
  )
}


// ============================================================
// 子元件:ReportContent (自動報告區內容)
// ============================================================
function ReportContent({ report }: { report: AutoReport }) {
  const delta = report.revenueDeltaPct
  const deltaSign = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const deltaColor = delta > 5 ? COLORS.success : delta < -5 ? COLORS.pink700 : COLORS.ink500
  const periodWord = report.period === 'week' ? '上週' : '上月'

  return (
    <div>
      {/* 期間 + 主指標 */}
      <div style={{
        padding: '10px 12px',
        marginBottom: 12,
        background: COLORS.pink50,
        borderRadius: 9,
        border: `1px solid ${COLORS.pink100}`,
      }}>
        <div className="vop-mono" style={{
          fontSize: 10, color: COLORS.pink700, fontWeight: 800,
          letterSpacing: '0.1em', marginBottom: 4,
        }}>
          // {report.periodLabel}
        </div>
        <div className="ai-stats-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}>
          <ReportStat
            label="總營收"
            value={`$${report.totalRevenue.toLocaleString()}`}
            sub={delta !== 0
              ? `${deltaSign} 較${periodWord} ${delta > 0 ? '+' : ''}${delta}%`
              : `較${periodWord}持平`}
            subColor={deltaColor}
          />
          <ReportStat
            label="總場次"
            value={`${report.totalSessions}`}
            sub="場"
          />
          <ReportStat
            label="總人次"
            value={`${report.totalPlayers}`}
            sub="人"
          />
          <ReportStat
            label="平均滿場率"
            value={`${report.avgFillRate}%`}
            sub={report.avgFillRate >= 75
              ? '高水位'
              : report.avgFillRate < 50 ? '產能偏低' : '健康區間'}
            subColor={report.avgFillRate >= 75
              ? COLORS.success
              : report.avgFillRate < 50 ? COLORS.pink600 : COLORS.ink500}
          />
        </div>
      </div>

      {/* 三欄:亮點 / 警示 / 建議 */}
      <div className="ai-three-col" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
      }}>
        <ReportColumn
          icon="✨"
          title="亮點"
          shortLabel="HIGHLIGHTS"
          accent={COLORS.success}
          items={report.highlights}
          emptyText="無特別亮點"
        />
        <ReportColumn
          icon="⚠️"
          title="警示"
          shortLabel="CONCERNS"
          accent={COLORS.pink600}
          items={report.concerns}
          emptyText="無需關注的警示"
        />
        <ReportColumn
          icon="💡"
          title="行動建議"
          shortLabel="ACTIONS"
          accent={COLORS.cyanDeep}
          items={report.recommendations}
          emptyText="無立即行動項目"
        />
      </div>
    </div>
  )
}


function ReportStat({
  label, value, sub, subColor,
}: { label: string; value: string; sub: string; subColor?: string }) {
  return (
    <div>
      <div className="vop-mono" style={{
        fontSize: 9, color: COLORS.ink500, fontWeight: 700,
        letterSpacing: '0.08em', marginBottom: 3,
      }}>
        {label}
      </div>
      <div className="vop-mono" style={{
        fontSize: 18, fontWeight: 800, color: COLORS.ink900,
        letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: subColor ?? COLORS.ink500, marginTop: 3,
      }}>
        {sub}
      </div>
    </div>
  )
}


function ReportColumn({
  icon, title, shortLabel, accent, items, emptyText,
}: {
  icon: string
  title: string
  shortLabel: string
  accent: string
  items: string[]
  emptyText: string
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${COLORS.border}`,
      borderRadius: 9,
      padding: '10px 12px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: accent,
        borderRadius: '9px 0 0 9px',
      }} />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, paddingBottom: 6,
        borderBottom: `1px dashed ${COLORS.borderLight}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.ink900 }}>
            {title}
          </span>
        </div>
        <span className="vop-mono" style={{
          fontSize: 9, fontWeight: 800, color: accent,
          letterSpacing: '0.12em',
        }}>
          // {shortLabel}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{
          padding: '8px 0', textAlign: 'center',
          fontSize: 11.5, color: COLORS.ink500, fontWeight: 600,
        }}>
          {emptyText}
        </div>
      ) : (
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {items.map((it, i) => (
            <li key={i} style={{
              display: 'flex', gap: 6,
              fontSize: 11.5, color: COLORS.ink900,
              lineHeight: 1.5, fontWeight: 600,
            }}>
              <span style={{ color: accent, fontWeight: 800, flexShrink: 0 }}>›</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
