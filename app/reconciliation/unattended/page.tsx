'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  getCurrentVisibleVenueIds,
  getUnattendedReportOverview,
  getUnattendedSessionDetail,
  sendSelfReportReminder,
  getLatestUnattendedSessionForDemo,
  type UnattendedSessionSummary,
  type UnattendedRegistrationRow,
  type SuspiciousCustomer,
} from '@/data/api'
import { useStoreSync, hydrateStore } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, Badge, Money, VENUE_COLOR,
} from '@/components/reconciliation/Common'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const date = new Date(dateStr + 'T00:00:00Z')
  return `${m}/${d}（${WEEKDAY[date.getUTCDay()]}）`
}


// ════════════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════════════

export default function UnattendedReconciliationPage() {
  // store 訂閱（階段 5 合併後單一）
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    hydrateStore()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overview = useMemo(() => getUnattendedReportOverview(visible), [visible, sv])

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedDetail = useMemo(() => {
    if (!selectedSessionId) return null
    return getUnattendedSessionDetail(selectedSessionId)
  }, [selectedSessionId, sv])

  // Demo 跳轉：找最近一場無人場次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demoSessionId = useMemo(() => getLatestUnattendedSessionForDemo('v4'), [sv])

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .un-wrap   { padding-top: 64px !important; }
          .un-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .un-grid   { grid-template-columns: 1fr !important; }
        }
        .un-row:hover { background: #fafaf7 !important; }
      `}</style>

      <div className="un-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="無人場次自助回報對照"
          subtitle={`最近 ${overview.lookbackDays} 天 · 自助回報 vs 實際入帳`}
          backTo="/reconciliation"
          actions={demoSessionId ? (
            <Link
              href={`/self-checkin/${demoSessionId}`}
              target="_blank"
              style={{
                fontSize: 12, padding: '8px 14px', borderRadius: 8,
                background: '#fef3c7', color: '#92400e', textDecoration: 'none',
                border: '1px solid #fcd34d', fontWeight: 600,
              }}
            >
              🚪 模擬客戶端 self-checkin（新分頁）
            </Link>
          ) : undefined}
        />

        {/* KPI */}
        <div className="un-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatCard
            label="期間應收總額"
            value={`$${overview.totalExpected.toLocaleString()}`}
            sub={`${overview.sessions.length} 場無人場次`}
          />
          <StatCard
            label="實際入帳"
            value={`$${overview.totalActual.toLocaleString()}`}
            sub="Payment 加總"
          />
          <StatCard
            label="缺口"
            value={`$${overview.totalDiscrepancy.toLocaleString()}`}
            sub={overview.totalExpected > 0 ? `${((overview.totalDiscrepancy / overview.totalExpected) * 100).toFixed(1)}%` : '0%'}
            intent={overview.totalDiscrepancy > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="自助回報率"
            value={`${(overview.overallSelfReportRate * 100).toFixed(0)}%`}
            sub={overview.trustGapCount > 0 ? `⚠️ ${overview.trustGapCount} 人說付未付` : '無信任落差'}
            intent={overview.trustGapCount > 0 ? 'warning' : 'default'}
            accent={overview.trustGapCount > 0 ? '#d97706' : undefined}
          />
        </div>

        {/* 主要 grid：場次清單 + 可疑客戶 */}
        <div className="un-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
          {/* 場次清單 */}
          <div>
            <SessionList
              sessions={overview.sessions}
              selectedSessionId={selectedSessionId}
              onSelect={setSelectedSessionId}
            />
            {selectedDetail && (
              <SessionDetailPanel
                summary={selectedDetail.summary}
                rows={selectedDetail.rows}
                onClose={() => setSelectedSessionId(null)}
              />
            )}
          </div>

          {/* 可疑名單 */}
          <SuspiciousList
            customers={overview.suspiciousCustomers}
            threshold={overview.suspiciousThreshold}
            lookbackDays={overview.lookbackDays}
          />
        </div>
      </div>
    </div>
  )
}


// ── 場次清單 ──────────────────────────────────────────────────

function SessionList({
  sessions, selectedSessionId, onSelect,
}: {
  sessions: UnattendedSessionSummary[]
  selectedSessionId: string | null
  onSelect: (id: string | null) => void
}) {
  if (sessions.length === 0) {
    return (
      <Panel title="無人場次清單">
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          本範圍內無無人場次。
          <br />
          <span style={{ fontSize: 11 }}>無人場次 = 沒有工讀生駐場、客戶自助投錢箱付款</span>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={`無人場次清單（${sessions.length} 場）`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0ede6', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <th style={{ textAlign: 'left',  padding: '10px 6px' }}>日期</th>
              <th style={{ textAlign: 'left',  padding: '10px 6px' }}>球館</th>
              <th style={{ textAlign: 'right', padding: '10px 6px' }}>應付/回報/實付</th>
              <th style={{ textAlign: 'right', padding: '10px 6px' }}>應收</th>
              <th style={{ textAlign: 'right', padding: '10px 6px' }}>實收</th>
              <th style={{ textAlign: 'right', padding: '10px 6px' }}>缺口</th>
              <th style={{ textAlign: 'center', padding: '10px 6px' }}>信號</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => {
              const isSelected = selectedSessionId === s.sessionId
              return (
                <tr
                  key={s.sessionId}
                  className="un-row"
                  onClick={() => onSelect(isSelected ? null : s.sessionId)}
                  style={{
                    borderBottom: '1px solid #f5f4f0',
                    cursor: 'pointer',
                    background: isSelected ? '#fef3c7' : undefined,
                  }}
                >
                  <td style={{ padding: '10px 6px' }}>{fmtDate(s.sessionDate)} {s.startTime}</td>
                  <td style={{ padding: '10px 6px' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[s.venueId] ?? '#aaa', marginRight: 6 }} />
                    {s.venueName}
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#666' }}>
                    {s.payableCount}/{s.selfReportedCount}/{s.actualPaidCount}
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <Money value={s.expectedRevenue} muted />
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <Money value={s.actualRevenue} />
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <Money value={s.discrepancyAmount} danger />
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                    {s.reportedButNoPayCount > 0 && (
                      <Badge color="red">⚠ 說付未付 {s.reportedButNoPayCount}</Badge>
                    )}
                    {s.reportedButNoPayCount === 0 && s.discrepancyAmount > 0 && (
                      <Badge color="yellow">缺{Math.round(s.discrepancyAmount)}</Badge>
                    )}
                    {s.discrepancyAmount <= 0 && <Badge color="green">齊</Badge>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 6px 4px', fontSize: 11, color: '#888' }}>
        💡 點任一列展開該場細節 · 「應/報/付」= 應付人數 / 自助回報 / 實際 Payment
      </div>
    </Panel>
  )
}


// ── 場次細節（drill-down） ───────────────────────────────────

function SessionDetailPanel({
  summary, rows, onClose,
}: {
  summary: UnattendedSessionSummary
  rows: UnattendedRegistrationRow[]
  onClose: () => void
}) {
  return (
    <Panel
      title={`${fmtDate(summary.sessionDate)} ${summary.startTime} ${summary.venueName} 細節`}
      action={
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}
        >
          ×
        </button>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0ede6', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <th style={{ textAlign: 'left',  padding: '8px 6px' }}>客戶</th>
              <th style={{ textAlign: 'left',  padding: '8px 6px' }}>類型</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>應付</th>
              <th style={{ textAlign: 'center', padding: '8px 6px' }}>自助回報</th>
              <th style={{ textAlign: 'center', padding: '8px 6px' }}>實際入帳</th>
              <th style={{ textAlign: 'center', padding: '8px 6px' }}>判斷</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.registrationId} style={{ borderBottom: '1px solid #f5f4f0' }}>
                <td style={{ padding: '8px 6px' }}>
                  {r.customerName}
                  <div style={{ fontSize: 10, color: '#aaa' }}>{r.customerPhone ?? '—'}</div>
                </td>
                <td style={{ padding: '8px 6px', color: '#666' }}>
                  {r.registrationType === 'season_player'     ? '季打' :
                   r.registrationType === 'season_substitute' ? '補位' : '臨打'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  {r.isPayable ? <Money value={r.expectedAmount} /> : <span style={{ color: '#aaa' }}>—</span>}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  {r.isPayable
                    ? (r.selfReportedPaid
                        ? <Badge color="blue">✓ {r.selfPaymentMethod ?? ''}</Badge>
                        : <Badge color="gray">尚未</Badge>)
                    : <span style={{ color: '#aaa' }}>—</span>}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  {r.isPayable
                    ? (r.hasActualPayment
                        ? <Badge color="green">已入 ${r.actualPaidAmount}</Badge>
                        : <Badge color="gray">未入</Badge>)
                    : <span style={{ color: '#aaa' }}>—</span>}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  {r.reportedNoPay && <Badge color="red">⚠ 說付未付</Badge>}
                  {r.paidNotReported && <Badge color="purple">補登</Badge>}
                  {r.isPayable && r.selfReportedPaid && r.hasActualPayment && <Badge color="green">齊</Badge>}
                  {r.isPayable && !r.selfReportedPaid && !r.hasActualPayment && <Badge color="red">遺漏</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, padding: '10px 12px', background: '#f5f4f0', borderRadius: 8, fontSize: 12, color: '#666' }}>
        <strong style={{ color: '#1a1917' }}>本場結算：</strong>
        應付 {summary.payableCount} 人 · 自助回報 {summary.selfReportedCount} 人 · 實際入帳 {summary.actualPaidCount} 人
        {summary.reportedButNoPayCount > 0 && (
          <span style={{ color: '#991b1b', marginLeft: 8 }}>
            · ⚠️ {summary.reportedButNoPayCount} 人說付未付（信任落差）
          </span>
        )}
        {summary.paidButNotReportedCount > 0 && (
          <span style={{ color: '#5b21b6', marginLeft: 8 }}>
            · ℹ️ {summary.paidButNotReportedCount} 人由館長補登
          </span>
        )}
      </div>
    </Panel>
  )
}


// ── 可疑名單 ──────────────────────────────────────────────────

function SuspiciousList({
  customers, threshold, lookbackDays,
}: {
  customers: SuspiciousCustomer[]
  threshold: number
  lookbackDays: number
}) {
  return (
    <Panel title={`⚠️ 可疑客戶（${customers.length}）`}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 10, lineHeight: 1.6 }}>
        最近 {lookbackDays} 天無人場次中，「未自助回報」次數 ≥ {threshold} 次。
      </div>

      {customers.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#10b981', fontSize: 13 }}>
          🎉 目前無可疑客戶
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {customers.map(c => (
          <div key={c.customerId}>
            <SuspiciousCustomerCard customer={c} />
          </div>
        ))}
      </div>
    </Panel>
  )
}

function SuspiciousCustomerCard({ customer }: { customer: SuspiciousCustomer }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  function handleSend() {
    setSending(true)
    const result = sendSelfReportReminder({
      customerId: customer.customerId,
      message: `提醒 ${customer.customerName}：最近 ${customer.unreportedCount} 場無人場次未自助回報，累積應繳 $${customer.totalOwedFromUnreported}`,
    })
    setSending(false)
    if (result.ok) {
      setSent(true)
      setTimeout(() => setSent(false), 3500)
    }
  }

  const severity = customer.unreportedCount >= 6 ? 'high'
    : customer.unreportedCount >= 4 ? 'medium' : 'low'
  const sevColor = severity === 'high' ? '#991b1b'
    : severity === 'medium' ? '#92400e' : '#92400e'
  const sevBg = severity === 'high' ? '#fee2e2'
    : severity === 'medium' ? '#fef3c7' : '#fef3c7'

  return (
    <div style={{
      padding: 10, background: sevBg, border: `1px solid ${sevColor}40`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1917' }}>
            {customer.customerName}
            <span style={{ fontSize: 11, fontWeight: 400, color: '#666', marginLeft: 6 }}>
              · {customer.primaryVenueName}
            </span>
          </div>
          <div style={{ fontSize: 11, color: sevColor, marginTop: 2 }}>
            {customer.customerPhone ?? '無電話'} ·
            <strong style={{ marginLeft: 4 }}>
              {customer.unreportedCount}/{customer.unattendedRegistrationsCount} 次未回報
            </strong>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Money value={customer.totalOwedFromUnreported} danger />
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>
        最近：{customer.recentUnreportedDates.slice(0, 3).map(d => fmtDate(d)).join(' · ')}
      </div>

      <button
        onClick={handleSend}
        disabled={sending || sent}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 6,
          border: 'none',
          background: sent ? '#10b981' : '#1a1917',
          color: '#fff', cursor: sending ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600,
        }}
      >
        {sent ? '✓ 已寫入 audit · 客戶將收到通知' :
         sending ? '送出中…' :
         '📲 一鍵發備註提醒'}
      </button>
    </div>
  )
}
