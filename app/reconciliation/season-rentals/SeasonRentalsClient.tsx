'use client'

// 季租單對帳畫面（client）。雙模式：
//   - 路由 /reconciliation/season-rentals：由 server 殼以 props 傳入（已 scope，真 DB）。
//   - 對帳 hub (collections) 的分頁：無 props → 退回讀 store（Phase 2 對帳 hub 尚未遷）。
// 球館篩選一律前端。

import { useEffect, useMemo, useState } from 'react'
import { getSeasonRentalReconciliation, listVenues, getCurrentVisibleVenueIds } from '@/data/api'
import { useStoreSync } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, Badge, ProgressBar, VENUE_COLOR,
} from '@/components/reconciliation/Common'
import type { SeasonRentalStatus } from '@/types'
import type { SeasonRentalReconRow } from '@/data/server/queries'

const STATUS_LABEL: Record<SeasonRentalStatus, string> = {
  pending: '待繳款', active: '進行中', completed: '已結束', cancelled: '已取消',
}
const STATUS_COLOR: Record<SeasonRentalStatus, 'green' | 'red' | 'yellow' | 'gray'> = {
  pending: 'red', active: 'green', completed: 'gray', cancelled: 'gray',
}

export default function SeasonRentalsClient({
  rentals: rentalsProp, venues: venuesProp,
}: {
  rentals?: SeasonRentalReconRow[]
  venues?: { id: string; name: string }[]
}) {
  const [venueId, setVenueId] = useState<string>('all')
  const storeMode = rentalsProp === undefined

  // store-mode（collections 分頁）：mount 後讀 store；server-mode 直接用 props
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { rentals, venues } = useMemo(() => {
    if (!storeMode) return { rentals: rentalsProp!, venues: venuesProp ?? [] }
    if (!mounted) return { rentals: [] as SeasonRentalReconRow[], venues: [] as { id: string; name: string }[] }
    const visible = getCurrentVisibleVenueIds()
    const allV = listVenues().filter(v => v.isActive)
    const vis = visible === 'all' ? allV : allV.filter(v => visible.includes(v.id))
    let all = getSeasonRentalReconciliation() as unknown as SeasonRentalReconRow[]
    if (visible !== 'all') {
      const names = new Set(vis.map(v => v.name))
      all = all.filter(r => r.venueName && names.has(r.venueName))
    }
    return { rentals: all, venues: vis.map(v => ({ id: v.id, name: v.name })) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeMode, rentalsProp, venuesProp, mounted, storeVersion])

  const filtered = useMemo(
    () => (venueId === 'all' ? rentals : rentals.filter(r => r.venueId === venueId)),
    [rentals, venueId],
  )

  const totals = useMemo(() => ({
    count: filtered.length,
    expected: filtered.reduce((s, r) => s + r.totalAmount, 0),
    actual: filtered.reduce((s, r) => s + r.paidAmount, 0),
    gap: filtered.reduce((s, r) => s + r.gap, 0),
    unpaidCount: filtered.filter(r => r.gap > 0).length,
  }), [filtered])

  const critical = filtered.filter(r => r.isCritical)

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .br-wrap   { padding-top: 64px !important; }
          .br-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .br-cards  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="br-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader title="季租單對帳" subtitle="主揪季初一次性繳款 — 應收 vs 實收" backTo="/reconciliation" />

        <div style={{ marginBottom: 16 }}>
          <select value={venueId} onChange={e => setVenueId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            <option value="all">全部球館</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="br-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="季租單總數" value={`${totals.count} 張`} accent="#d4a843" />
          <StatCard label="總應收" value={`$${totals.expected.toLocaleString()}`} accent="#2563eb" />
          <StatCard label="總實收" value={`$${totals.actual.toLocaleString()}`} accent="#10b981" />
          <StatCard label="未繳齊" value={`$${totals.gap.toLocaleString()}`} sub={totals.unpaidCount > 0 ? `${totals.unpaidCount} 張` : '全數收齊'} intent={totals.gap > 0 ? 'danger' : 'default'} accent="#e85d3a" />
        </div>

        {critical.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '2px solid #fca5a5', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 32 }}>🚨</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>{critical.length} 張季租單待主揪繳清</div>
              <div style={{ fontSize: 12, color: '#7f1d1d' }}>
                {critical.map(r => `${r.captainName}（${r.venueName}）${Math.round(r.paidRatio * 100)}%`).join('、')}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>
              缺 ${critical.reduce((s, r) => s + r.gap, 0).toLocaleString()}
            </div>
          </div>
        )}

        <div className="br-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {filtered.length === 0 ? (
            <Panel><div style={{ padding: '40px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>沒有季租單資料</div></Panel>
          ) : filtered.map(r => <RentalCard key={r.rentalId} rental={r} />)}
        </div>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 16 }}>
          應收 = 球費 × 18 人 × 12 週　|　實收 = 主揪實際繳交金額　|　pending = 主揪尚未繳清
        </div>
      </div>
    </div>
  )
}

function RentalCard({ rental: r }: { rental: SeasonRentalReconRow }) {
  const isCritical = r.isCritical
  const accent = isCritical ? '#e85d3a' : r.isFullyPaid ? '#10b981' : '#d4a843'
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: isCritical ? '2px solid #fca5a5' : '1px solid #e8e6e0', padding: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: accent }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1917' }}>
            {r.captainName}{isCritical && <span style={{ marginLeft: 6, fontSize: 14 }}>🚨</span>}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{r.captainPhone} · 主揪</div>
        </div>
        <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: VENUE_COLOR[r.venueId] || '#999' }} />
        <span style={{ fontWeight: 500 }}>{r.venueName}</span>
        <span style={{ color: '#ccc' }}>·</span>
        <span>{r.timeslotLabel}</span>
      </div>
      <div style={{ background: '#fafaf8', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <AmountRow label="應收（季初）" value={r.totalAmount} />
        <AmountRow label="實收" value={r.paidAmount} green={r.isFullyPaid} />
        <div style={{ borderTop: '1px solid #e8e6e0', marginTop: 8, paddingTop: 8 }}>
          <AmountRow label={r.gap > 0 ? '尚欠' : r.gap < 0 ? '溢繳' : '已繳清'} value={Math.abs(r.gap)} danger={r.gap > 0} bold />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#888' }}>繳款進度</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: isCritical ? '#e85d3a' : '#1a1917' }}>{Math.round(r.paidRatio * 100)}%</span>
        </div>
        <ProgressBar ratio={r.paidRatio} accent={accent} height={8} />
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>每場 ${r.pricePerSession.toLocaleString()}</span>
        <span>場次 {r.completedSessionCount}/{r.generatedSessionCount}</span>
      </div>
    </div>
  )
}

function AmountRow({ label, value, danger, green, bold }: { label: string; value: number; danger?: boolean; green?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: bold ? 16 : 14, fontWeight: bold ? 700 : 500, color: danger ? '#e85d3a' : green ? '#10b981' : '#1a1917' }}>
        ${value.toLocaleString()}
      </span>
    </div>
  )
}
