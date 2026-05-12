'use client'

// ============================================================
// /performance — 館長績效（階段 4 pitch demo）
// ============================================================
// 結構：
//   1. Header        — 標題 + 月份標籤
//   2. KPI 卡 × 4    — 獎金池 / 冠軍 / 平均 K / 待改善
//   3. 排行榜 table  — 6 行（owner）或 1 行（manager）
//   4. 走勢圖（SVG） — 過去 6 個月各館獎金
//   5. 審梸卡        — K 拆解 + 季預測 + AI 建議
//
// 視角過濾完全沿用 3.5 pattern：
//   - getCurrentVisibleVenueIds() 在 mount 後讀
//   - mount 前用 'all' fallback 避免 SSR 閃爍
//   - manager 自動看自己館；staff/none 被 LayoutGuard 擋（不會進這頁）
// ============================================================

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentVisibleVenueIds, getPerformanceOverview,
  type VenuePerformance,
} from '@/data/api'
import { useStoreSync } from '@/data/store'


// 各館配色（與其他頁一致）
const VENUE_COLOR: Record<string, string> = {
  v1: '#7c6af7', v2: '#0ea5e9', v3: '#f59e0b',
  v4: '#10b981', v5: '#f43f5e', v6: '#a855f7',
}

function dollar(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}
function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}
function deltaTag(pctVal: number): { color: string; sign: string; text: string } {
  if (Math.abs(pctVal) < 0.005) return { color: '#888', sign: '', text: '持平' }
  if (pctVal > 0)  return { color: '#10b981', sign: '+', text: pct(pctVal, 1) }
  return { color: '#ef4444', sign: '', text: pct(pctVal, 1) }
}


// ============================================================
// 主元件
// ============================================================

export default function PerformancePage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // SSR-safe：mount 前用 'all'，避免 server/client mismatch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overview = useMemo(() => getPerformanceOverview(visible), [visible, storeVersion])

  // 審梸卡選中的館；預設 = 排行榜第一名
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)

  // 視角切換後，若選中的館不在視角內 → reset 成 null（自動 fallback 到 top）
  useEffect(() => {
    if (selectedVenueId && !overview.venues.some(v => v.venueId === selectedVenueId)) {
      setSelectedVenueId(null)
    }
  }, [overview.venues, selectedVenueId])

  const selected: VenuePerformance | null = useMemo(() => {
    if (!selectedVenueId) return overview.topPerformer
    return overview.venues.find(v => v.venueId === selectedVenueId) ?? overview.topPerformer
  }, [selectedVenueId, overview])

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .perf-wrap { padding-top: 64px !important; }
          .perf-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .perf-projection-grid { grid-template-columns: 1fr !important; }
          .perf-table-wrap { overflow-x: auto; }
        }
      `}</style>

      <div className="perf-wrap">
        {/* Header */}
        <div style={{
          marginBottom: 20, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
              🏆 館長績效
            </h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
              {overview.monthLabel} ·
              {overview.isFiltered
                ? ` 視角內 ${overview.visibleCount} 個館`
                : ` 共 ${overview.visibleCount} 個館`}
            </p>
          </div>
          <div style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12,
            background: '#fef3c7', color: '#854d0e',
            border: '1px solid #fde68a',
          }}>
            💡 獎金 = 入帳 × 5% × K 係數（拆解見下方審梸卡）
          </div>
        </div>

        {/* KPI 卡 */}
        <KPICards overview={overview} />

        {/* 排行榜 */}
        <Leaderboard
          overview={overview}
          selectedVenueId={selected?.venueId ?? null}
          onSelect={setSelectedVenueId}
        />

        {/* 走勢圖 */}
        <TrendChart overview={overview} />

        {/* 審梸卡 */}
        {selected ? (
          <ProjectionCard perf={selected} />
        ) : (
          <EmptyProjection />
        )}
      </div>
    </div>
  )
}


// ============================================================
// KPI 卡 × 4
// ============================================================

function KPICards({ overview }: { overview: ReturnType<typeof getPerformanceOverview> }) {
  const delta = deltaTag(overview.bonusPoolDeltaPct)
  const champion = overview.topPerformer
  const worst = overview.worstPerformer
  const isSingleVenue = overview.visibleCount === 1

  return (
    <div className="perf-kpi-grid" style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12, marginBottom: 20,
    }}>
      <Kpi
        label={isSingleVenue ? '我的本月獎金' : '本月獎金池'}
        value={dollar(overview.bonusPoolTotal)}
        sub={<span style={{ color: delta.color, fontWeight: 600 }}>{delta.sign}{delta.text} vs 上月</span>}
        accent="#d4a843"
      />
      <Kpi
        label={isSingleVenue ? '我的 K 係數' : '本月績效冠軍'}
        value={
          isSingleVenue
            ? (champion ? champion.coefficient.toFixed(2) : '—')
            : (champion ? dollar(champion.bonus) : '—')
        }
        sub={
          champion && !isSingleVenue
            ? <span style={{ color: '#666' }}>{champion.venueName} · {champion.managerName ?? '館長空缺'}</span>
            : champion && isSingleVenue
            ? <span style={{ color: '#666' }}>滿分 1.00（K 上限）</span>
            : <span style={{ color: '#888' }}>—</span>
        }
        accent="#10b981"
      />
      <Kpi
        label="平均 K 係數"
        value={overview.averageCoefficient.toFixed(2)}
        sub={<span style={{ color: '#666' }}>滿分 1.00（K ∈ [0.50, 1.00]）</span>}
        accent="#7c6af7"
      />
      <Kpi
        label={isSingleVenue ? '我的卡點' : '待改善館'}
        value={worst ? worst.venueName : '—'}
        sub={
          worst
            ? <span style={{ color: '#ef4444' }}>K = {worst.coefficient.toFixed(2)} · {dollar(worst.bonus)}</span>
            : <span style={{ color: '#888' }}>—</span>
        }
        accent="#ef4444"
      />
    </div>
  )
}

function Kpi({ label, value, sub, accent }: {
  label: string; value: string; sub: React.ReactNode; accent: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      border: '1px solid #eee', borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, marginTop: 6 }}>{sub}</div>
    </div>
  )
}


// ============================================================
// 排行榜
// ============================================================

function Leaderboard({ overview, selectedVenueId, onSelect }: {
  overview: ReturnType<typeof getPerformanceOverview>
  selectedVenueId: string | null
  onSelect: (id: string) => void
}) {
  if (overview.venues.length === 0) {
    return (
      <div style={{
        background: '#fff', borderRadius: 12, padding: 32, marginBottom: 20,
        textAlign: 'center', color: '#888', border: '1px solid #eee',
      }}>
        視角內沒有可顯示的館。
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16, marginBottom: 20,
      border: '1px solid #eee',
    }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>📊 本月排行榜</h2>
        <span style={{ fontSize: 11, color: '#888' }}>點任一行查看審梸詳情 ↓</span>
      </div>

      <div className="perf-table-wrap">
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13,
          minWidth: 760,
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#666' }}>
              <Th style={{ width: 36, textAlign: 'center' }}>#</Th>
              <Th>館</Th>
              <Th>館長</Th>
              <Th style={{ textAlign: 'right' }}>本月入帳</Th>
              <Th style={{ textAlign: 'right' }}>HZ 率</Th>
              <Th style={{ textAlign: 'right' }}>入帳率</Th>
              <Th style={{ textAlign: 'right' }}>贈送比</Th>
              <Th style={{ textAlign: 'right' }}>K</Th>
              <Th style={{ textAlign: 'right' }}>獎金</Th>
            </tr>
          </thead>
          <tbody>
            {overview.venues.map((p, idx) => {
              const isSelected = p.venueId === selectedVenueId
              const venueColor = VENUE_COLOR[p.venueId] ?? '#666'
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''
              return (
                <tr key={p.venueId}
                  onClick={() => onSelect(p.venueId)}
                  style={{
                    borderBottom: '1px solid #f4f4f4',
                    cursor: 'pointer',
                    background: isSelected ? '#fef9e7' : 'transparent',
                  }}
                >
                  <Td style={{ textAlign: 'center', fontWeight: 600, color: '#666' }}>
                    {medal || idx + 1}
                  </Td>
                  <Td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: venueColor, display: 'inline-block',
                      }} />
                      <span style={{ fontWeight: 600 }}>{p.venueName}</span>
                    </span>
                  </Td>
                  <Td>
                    {p.managerName ? (
                      <span>{p.managerName}</span>
                    ) : (
                      <span style={{ color: '#bbb', fontSize: 12 }}>（館長空缺）</span>
                    )}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {dollar(p.monthRevenue)}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.hotZoneSessionRate >= 0.5 ? '#10b981' : '#888' }}>
                    {pct(p.hotZoneSessionRate, 0)}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.collectionRate >= 0.85 ? '#10b981' : p.collectionRate >= 0.7 ? '#888' : '#ef4444' }}>
                    {pct(p.collectionRate, 0)}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.giftRatio >= 0.5 ? '#ef4444' : p.giftRatio >= 0.3 ? '#f59e0b' : '#888' }}>
                    {pct(p.giftRatio, 0)}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {p.coefficient.toFixed(2)}
                  </Td>
                  <Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#1a1917' }}>
                    {dollar(p.bonus)}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: '10px 8px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', ...style }}>{children}</th>
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 8px', ...style }}>{children}</td>
}


// ============================================================
// 走勢圖（SVG，沒裝 chart 套件）
// ============================================================

function TrendChart({ overview }: { overview: ReturnType<typeof getPerformanceOverview> }) {
  if (overview.venues.length === 0) return null

  // SVG 尺寸
  const W = 760, H = 240
  const PAD_L = 56, PAD_R = 16, PAD_T = 16, PAD_B = 28

  // 把所有 venue 的 trend 合併找 y 軸範圍
  const months = overview.venues[0]?.trend.map(t => t.monthLabel) ?? []
  const maxBonus = Math.max(
    1,
    ...overview.venues.flatMap(v => v.trend.map(t => t.bonus)),
  )
  // 漂亮一點的上限：往上取整到最近的「1萬」
  const yMax = Math.ceil(maxBonus / 10000) * 10000 || 10000

  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const stepX = months.length > 1 ? innerW / (months.length - 1) : 0
  const xAt = (i: number) => PAD_L + i * stepX
  const yAt = (v: number) => PAD_T + innerH - (v / yMax) * innerH

  // Y 軸刻度（4 條水平 grid）
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax]

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16, marginBottom: 20,
      border: '1px solid #eee',
    }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>📈 過去 6 個月獎金走勢</h2>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
          {overview.venues.map(v => (
            <span key={v.venueId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#444' }}>
              <span style={{
                width: 14, height: 3,
                background: VENUE_COLOR[v.venueId] ?? '#666',
                display: 'inline-block', borderRadius: 1,
              }} />
              {v.venueName}
            </span>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', minWidth: 600 }}
        >
          {/* Y 軸 grid + 標籤 */}
          {yTicks.map((tv, i) => {
            const y = yAt(tv)
            return (
              <g key={i}>
                <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
                  stroke="#eee" strokeWidth={1} />
                <text x={PAD_L - 6} y={y + 4} fontSize={10} fill="#888" textAnchor="end">
                  {tv >= 1000 ? `${(tv / 1000).toFixed(0)}K` : tv.toFixed(0)}
                </text>
              </g>
            )
          })}

          {/* X 軸標籤 */}
          {months.map((m, i) => (
            <text key={i} x={xAt(i)} y={H - PAD_B + 16}
              fontSize={11} fill="#666" textAnchor="middle">{m}</text>
          ))}

          {/* 各館 polyline */}
          {overview.venues.map(v => {
            const color = VENUE_COLOR[v.venueId] ?? '#666'
            const points = v.trend.map((t, i) => `${xAt(i)},${yAt(t.bonus)}`).join(' ')
            return (
              <g key={v.venueId}>
                <polyline points={points} fill="none" stroke={color} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" />
                {v.trend.map((t, i) => (
                  <circle key={i} cx={xAt(i)} cy={yAt(t.bonus)} r={3}
                    fill={color} stroke="#fff" strokeWidth={1.5}>
                    <title>{v.venueName} {t.monthLabel}：{dollar(t.bonus)}</title>
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}


// ============================================================
// 審梸卡 — K 拆解 + 季預測 + AI 建議
// ============================================================

function ProjectionCard({ perf }: { perf: VenuePerformance }) {
  const venueColor = VENUE_COLOR[perf.venueId] ?? '#666'

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      border: '1px solid #eee', borderLeft: `4px solid ${venueColor}`,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          🔍 審梸卡：{perf.venueName} · {perf.managerName ?? <span style={{ color: '#bbb' }}>（館長空缺）</span>}
        </h2>
        <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
          本月入帳 {dollar(perf.monthRevenue)} ·
          基準提成 P = {dollar(perf.baseCommission)} ·
          K = {perf.coefficient.toFixed(2)} ·
          <strong style={{ color: '#1a1917' }}> 獎金 B = {dollar(perf.bonus)}</strong>
        </p>
      </div>

      <div className="perf-projection-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16,
      }}>
        {/* K 拆解 */}
        <div style={{ padding: 14, background: '#fafaf8', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#888', fontWeight: 500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            K 係數拆解
          </div>
          <CoefRow label="保底"             value={perf.coefBase}       max={0.50} color="#888"    />
          <CoefRow label="Hot Zone 加成"    value={perf.coefHotZone}    max={0.20} color="#f59e0b" detail={`(0.20 × ${pct(perf.hotZoneSessionRate, 0)})`} />
          <CoefRow label="入帳率加成"        value={perf.coefCollection} max={0.20} color="#10b981" detail={`(0.20 × ${pct(perf.collectionRate, 0)})`} />
          <CoefRow label="贈送比加成"        value={perf.coefGift}       max={0.10} color="#7c6af7" detail={`(0.10 × (1 - ${pct(perf.giftRatio, 0)}))`} />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            paddingTop: 8, marginTop: 6, borderTop: '1px solid #ddd',
            fontWeight: 600, fontSize: 13,
          }}>
            <span>合計 K</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{perf.coefficient.toFixed(3)}</span>
          </div>
        </div>

        {/* 季預測 */}
        <div style={{ padding: 14, background: '#fafaf8', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#888', fontWeight: 500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            本季預期 · {perf.seasonProjection.quarterLabel}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: '#444' }}>已實現（{perf.seasonProjection.monthsRealized} 個月）</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {dollar(perf.seasonProjection.realized)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: '#444' }}>預測剩餘（{perf.seasonProjection.monthsRemaining} 個月）</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#888' }}>
                {dollar(perf.seasonProjection.projected)}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingTop: 8, marginTop: 8, borderTop: '1px solid #ddd',
              fontSize: 14, fontWeight: 700,
            }}>
              <span>本季預期總計</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: venueColor }}>
                {dollar(perf.seasonProjection.total)}
              </span>
            </div>
          </div>

          {/* 進度條 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(perf.seasonProjection.realized / Math.max(perf.seasonProjection.total, 1)) * 100}%`,
                background: venueColor,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
              已過 {perf.seasonProjection.monthsRealized} / {perf.seasonProjection.monthsRealized + perf.seasonProjection.monthsRemaining} 個月
            </div>
          </div>
        </div>
      </div>

      {/* AI 建議 */}
      <div style={{
        padding: 12, background: '#fef3c7', borderRadius: 8,
        border: '1px solid #fde68a', fontSize: 13, color: '#854d0e',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>AI 建議</div>
          <div style={{ lineHeight: 1.6 }}>{perf.insight}</div>
        </div>
      </div>
    </div>
  )
}

function CoefRow({ label, value, max, color, detail }: {
  label: string; value: number; max: number; color: string; detail?: string
}) {
  const ratio = max > 0 ? value / max : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: '#444' }}>
          {label}{detail && <span style={{ color: '#999', marginLeft: 4 }}>{detail}</span>}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          +{value.toFixed(3)}
        </span>
      </div>
      <div style={{ height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, ratio * 100)}%`,
          background: color,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}


// ============================================================
// 空狀態（理論上 LayoutGuard 已擋，這裡保底）
// ============================================================

function EmptyProjection() {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 32,
      textAlign: 'center', color: '#888', border: '1px solid #eee',
    }}>
      視角內沒有可顯示的館。
      <div style={{ marginTop: 12 }}>
        <Link href="/dashboard" style={{
          color: '#d4a843', textDecoration: 'none', fontSize: 13,
        }}>← 回到總覽</Link>
      </div>
    </div>
  )
}
