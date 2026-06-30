'use client'

// 異常清單（client）。資料由 server 殼以 props 傳入（已 scope，真 DB）。
// 類型 / 嚴重度 / 球館 三個篩選一律前端。
// 註：目前涵蓋 季租未付 / 場次少收 / 無人場次落差；商品贈送(P2.4)、月記帳(P2.2d) 待遷。

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ANOMALY_TYPE_LABEL, type ReconciliationAnomalyType, type AnomalySeverity } from '@/data/api'
import { ReconHeader, StatCard, Panel, SeverityBadge, Money, VENUE_COLOR } from '@/components/reconciliation/Common'
import type { ReconAnomalyRow } from '@/data/server/queries'

const TYPE_ICON: Record<string, string> = {
  session_shortfall: '📅', rental_unpaid: '🎫', gift_excess: '📦', self_report_mismatch: '🤖',
  ledger_negative_balance: '📒', ledger_revenue_omission: '🕳️', ledger_deposit_mismatch: '🏦',
}
const SEVERITY_OPTIONS: { value: AnomalySeverity | 'all'; label: string }[] = [
  { value: 'all', label: '全部嚴重度' }, { value: 'high', label: '嚴重' }, { value: 'medium', label: '中度' }, { value: 'low', label: '輕微' },
]
type Venue = { id: string; name: string }

function linkFor(linkType: string, linkId: string): string {
  if (linkType === 'session') return `/sessions/${linkId}`
  if (linkType === 'rental') return `/reconciliation/season-rentals`
  if (linkType === 'product') return `/reconciliation/products`
  return '#'
}

export default function AnomaliesClient({ anomalies, venues }: { anomalies: ReconAnomalyRow[]; venues: Venue[] }) {
  const [typeFilter, setTypeFilter] = useState<ReconciliationAnomalyType | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all')
  const [venueId, setVenueId] = useState<string>('all')

  // 只列出實際出現過的異常類型，避免下拉一堆空類型
  const presentTypes = useMemo(() => Array.from(new Set(anomalies.map((a) => a.type))), [anomalies])

  const filtered = useMemo(() => anomalies.filter((a) =>
    (typeFilter === 'all' || a.type === typeFilter) &&
    (severityFilter === 'all' || a.severity === severityFilter) &&
    (venueId === 'all' || a.venueId === venueId)
  ), [anomalies, typeFilter, severityFilter, venueId])

  const counts = useMemo(() => ({
    total: anomalies.length,
    high: anomalies.filter((a) => a.severity === 'high').length,
    medium: anomalies.filter((a) => a.severity === 'medium').length,
    low: anomalies.filter((a) => a.severity === 'low').length,
    totalAmount: anomalies.reduce((s, a) => s + a.amount, 0),
  }), [anomalies])
  const filteredAmount = filtered.reduce((s, a) => s + a.amount, 0)

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .an-wrap { padding-top: 64px !important; }
          .an-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .an-filter { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      <div className="an-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader title="異常清單" subtitle="所有需要追蹤的差異 — 依嚴重度排序" backTo="/reconciliation" />

        <div className="an-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="異常總數" value={`${counts.total} 筆`} sub={`涉及 $${counts.totalAmount.toLocaleString()}`} accent="#7c6af7" />
          <StatCard label="嚴重" value={`${counts.high} 筆`} intent={counts.high > 0 ? 'danger' : 'default'} accent="#dc2626" />
          <StatCard label="中度" value={`${counts.medium} 筆`} intent={counts.medium > 0 ? 'warning' : 'default'} accent="#f59e0b" />
          <StatCard label="輕微" value={`${counts.low} 筆`} accent="#9ca3af" />
        </div>

        <div className="an-filter" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ReconciliationAnomalyType | 'all')} style={selectStyle}>
            <option value="all">全部類型</option>
            {presentTypes.map((t) => <option key={t} value={t}>{ANOMALY_TYPE_LABEL[t as ReconciliationAnomalyType]}</option>)}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as AnomalySeverity | 'all')} style={selectStyle}>
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={selectStyle}>
            <option value="all">全部球館</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>符合條件 {filtered.length} 筆 · 涉及 ${filteredAmount.toLocaleString()}</span>
        </div>

        <Panel>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>
              {counts.total === 0 ? '🎉 目前沒有任何異常' : '此條件下無異常項目'}
            </div>
          ) : (
            <div>
              {filtered.map((a) => (
                <Link key={a.id} href={linkFor(a.linkType, a.linkId)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid #f0ede6', textDecoration: 'none', color: '#1a1917', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{TYPE_ICON[a.type]}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <SeverityBadge severity={a.severity} />
                    <span style={{ fontSize: 11, color: '#888', background: '#f5f4f0', padding: '2px 8px', borderRadius: 999 }}>{ANOMALY_TYPE_LABEL[a.type as ReconciliationAnomalyType]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{a.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 11, color: '#888' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: VENUE_COLOR[a.venueId] || '#999' }} />
                        {a.venueName}
                      </div>
                      {a.date && <span>· {a.date}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 100 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e85d3a' }}><Money value={a.amount} danger /></div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>查看 →</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8 }}>
          異常條件：場次少收 ≥ $200・季租單 gap &gt; 0・無人場次自助回報筆數 &gt; Payment 筆數（商品贈送、月記帳異常待 P2.4 / P2.2d 遷移後納入）
        </div>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff', cursor: 'pointer' }
