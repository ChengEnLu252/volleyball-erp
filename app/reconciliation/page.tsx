'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  getCurrentVisibleVenueIds,
  getFilteredReconciliationOverview,
  ANOMALY_TYPE_LABEL,
} from '@/data/api'
import { useStoreSync } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, SeverityBadge, Money,
} from '@/components/reconciliation/Common'

// 階段 21 M2：對帳簡化 — 15 子頁合併為 5 個入口（各入口內以頁籤切換原子頁）
const SUBPAGES: {
  href: string
  icon: string
  title: string
  desc: string
  accent: string
}[] = [
  { href: '/reconciliation/collections', icon: '💵', title: '收款對帳',   desc: '場次 / 季租單 / 商品 / 無人場次 / 誠實商店',   accent: '#2563eb' },
  { href: '/reconciliation/bookkeeping', icon: '📒', title: '記帳對帳',   desc: '館長月記帳輸入、對帳差異、月結',             accent: '#0d9488' },
  { href: '/reconciliation/staff-pay',   icon: '🧑‍💼', title: '員工薪資',  desc: '工讀生時薪 + 管理職薪資（含冷門/年終獎金）', accent: '#0f766e' },
  { href: '/reconciliation/compliance',  icon: '🧾', title: '規章罰則',   desc: '採購簽核 / 零用金 / 比賽企劃 / 報表繳交',     accent: '#b45309' },
  { href: '/reconciliation/anomalies',   icon: '⚠️',  title: '異常清單',   desc: '所有需要追蹤的差異一覽',                     accent: '#e85d3a' },
]

export default function ReconciliationOverviewPage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  const ov = useMemo(() => getFilteredReconciliationOverview(visible), [visible])
  const collectionRate = ov.week.expected > 0
    ? Math.round((ov.week.actual / ov.week.expected) * 1000) / 10
    : 100

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .recon-wrap     { padding-top: 64px !important; }
          .recon-stats    { grid-template-columns: repeat(2, 1fr) !important; }
          .recon-subpages { grid-template-columns: 1fr !important; }
          .recon-main     { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="recon-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="對帳系統"
          subtitle="把「看不到錢的真實流向」這件事，變成看得到"
        />

        {/* KPI 4 卡 */}
        <div className="recon-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard
            label="本週應收"
            value={`$${ov.week.expected.toLocaleString()}`}
            sub={`${ov.week.sessionCount} 場`}
            accent="#d4a843"
          />
          <StatCard
            label="本週實收"
            value={`$${ov.week.actual.toLocaleString()}`}
            sub={`收款率 ${collectionRate}%`}
            accent="#10b981"
          />
          <StatCard
            label="本週缺口"
            value={`$${ov.week.gap.toLocaleString()}`}
            sub={`${ov.summary.sessionShortfallCount} 場少收`}
            intent={ov.week.gap > 0 ? 'danger' : 'default'}
            accent="#e85d3a"
          />
          <StatCard
            label="待處理異常"
            value={`${ov.summary.anomalyTotalCount} 筆`}
            sub={ov.summary.rentalUnpaidCount > 0 ? `主揪欠款 ${ov.summary.rentalUnpaidCount} 件` : '全數已對齊'}
            intent={ov.summary.anomalyTotalCount > 0 ? 'warning' : 'default'}
            accent="#7c6af7"
          />
        </div>

        {/* 故事點 banner：top 3 高警示 */}
        {ov.topAnomalies.length > 0 && (
          <Panel
            title={`🚨 需立即關注（前 ${ov.topAnomalies.length} 筆）`}
            action={
              <Link href="/reconciliation/anomalies" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>
                看全部 →
              </Link>
            }
          >
            {ov.topAnomalies.map(a => (
              <div key={a.id} style={{
                padding: '11px 0', borderBottom: '1px solid #f0ede6',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <SeverityBadge severity={a.severity} />
                <span style={{ fontSize: 11, color: '#888', background: '#f5f4f0', padding: '2px 8px', borderRadius: 999 }}>
                  {ANOMALY_TYPE_LABEL[a.type]}
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1917' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{a.description}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e85d3a' }}>
                  <Money value={a.amount} danger />
                </div>
              </div>
            ))}
          </Panel>
        )}

        {/* 雙欄：本月摘要 + 各區塊 summary */}
        <div className="recon-main" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Panel title="本月對帳摘要">
            <div style={{ padding: '8px 0' }}>
              <SummaryRow label="本月應收" value={`$${ov.month.expected.toLocaleString()}`} />
              <SummaryRow label="本月實收" value={`$${ov.month.actual.toLocaleString()}`} />
              <SummaryRow
                label="本月缺口"
                value={`$${ov.month.gap.toLocaleString()}`}
                danger={ov.month.gap > 0}
              />
              {ov.summary.monthlyMaxGap && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#9a3412', fontWeight: 600, marginBottom: 2 }}>
                    本月缺口最大
                  </div>
                  <div style={{ fontSize: 13, color: '#1a1917' }}>
                    <strong>{ov.summary.monthlyMaxGap.venueName}</strong> 缺口 <Money value={ov.summary.monthlyMaxGap.gap} danger />
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="分項統計">
            <div style={{ padding: '8px 0' }}>
              <SummaryRow
                label="場次少收"
                value={`${ov.summary.sessionShortfallCount} 場`}
                detail={ov.summary.sessionShortfallAmount > 0 ? `$${ov.summary.sessionShortfallAmount.toLocaleString()}` : undefined}
              />
              <SummaryRow
                label="季租單未繳齊"
                value={`${ov.summary.rentalUnpaidCount} 張`}
                detail={ov.summary.rentalUnpaidAmount > 0 ? `$${ov.summary.rentalUnpaidAmount.toLocaleString()}` : undefined}
                danger={ov.summary.rentalUnpaidCount > 0}
              />
              <SummaryRow
                label="商品贈送異常"
                value={`${ov.summary.productAnomalyCount} 項`}
                danger={ov.summary.productAnomalyCount > 0}
              />
            </div>
          </Panel>
        </div>

        {/* 子頁入口 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888', margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          進入各對帳區塊
        </div>
        <div className="recon-subpages" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {SUBPAGES.map(sp => (
            <Link key={sp.href} href={sp.href} style={{
              background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12,
              padding: '20px 18px', textDecoration: 'none', color: '#1a1917',
              position: 'relative', overflow: 'hidden',
              transition: 'all .15s',
              display: 'block',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: sp.accent }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{sp.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{sp.title}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{sp.desc}</div>
              <div style={{ fontSize: 11, color: sp.accent, fontWeight: 600, marginTop: 10 }}>
                進入 →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  label, value, detail, danger,
}: {
  label: string
  value: string
  detail?: string
  danger?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid #f5f4f0',
    }}>
      <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {detail && <span style={{ fontSize: 11, color: '#888' }}>{detail}</span>}
        <span style={{ fontSize: 14, fontWeight: 600, color: danger ? '#e85d3a' : '#1a1917' }}>
          {value}
        </span>
      </div>
    </div>
  )
}
