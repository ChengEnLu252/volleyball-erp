'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getCurrentVisibleVenueIds,
  getHonestShopOverview,
  listBoxAudits,
  previewBoxAudit,
  recordBoxAudit,
  type HonestShopVenueProductSummary,
  type BoxAuditRecord,
} from '@/data/api'
import { useStoreSync, hydrateStore } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, Badge, Money, VENUE_COLOR,
} from '@/components/reconciliation/Common'

function fmt(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}/${d}`
}


// ════════════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════════════

export default function HonestShopReconciliationPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    hydrateStore()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overview = useMemo(() => getHonestShopOverview(visible), [visible, sv])

  const [auditTarget, setAuditTarget] = useState<HonestShopVenueProductSummary | null>(null)
  const [historyTarget, setHistoryTarget] = useState<HonestShopVenueProductSummary | null>(null)

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .hs-wrap   { padding-top: 64px !important; }
          .hs-stats  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .hs-row:hover { background: #fafaf7 !important; }
      `}</style>

      <div className="hs-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="誠實商店 · 投錢箱對帳"
          subtitle={`最近 ${overview.lookbackDays} 天 · 帳面銷售 vs 投錢箱實收`}
          backTo="/reconciliation"
        />

        {/* KPI */}
        <div className="hs-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatCard
            label="期間帳面銷售"
            value={`$${overview.totalRevenue.toLocaleString()}`}
            sub={`${overview.rows.length} 個館 × ${[...new Set(overview.rows.map(r => r.productName))].join('、')}`}
          />
          <StatCard
            label="已盤點次數"
            value={`${overview.auditCount}`}
            sub={overview.auditCount === 0 ? '尚未盤點' : `${[...new Set(overview.rows.filter(r => r.lastAudit).map(r => r.venueName))].length} 館有記錄`}
          />
          <StatCard
            label="累積發現缺口"
            value={`$${overview.totalDiscrepancy.toLocaleString()}`}
            sub={overview.totalDiscrepancy > 0
              ? `平均誠實率 ${(overview.averageHonestyRate * 100).toFixed(1)}%`
              : '無缺口'}
            intent={overview.totalDiscrepancy > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="異常旗標"
            value={`${overview.flaggedCount}`}
            sub={overview.flaggedCount === 0
              ? '無異常'
              : `匿名 ≥ ${(overview.anonymousRatioThreshold * 100).toFixed(0)}% 或缺口顯著`}
            intent={overview.flaggedCount > 0 ? 'warning' : 'default'}
            accent={overview.flaggedCount > 0 ? '#d97706' : undefined}
          />
        </div>

        {/* 主表格 */}
        <Panel title={`各館誠實商店概況（${overview.rows.length}）`}>
          {overview.rows.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              本範圍內無誠實商店商品。
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0ede6', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    <th style={{ textAlign: 'left',  padding: '10px 6px' }}>球館 / 商品</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px' }}>當前庫存</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px' }}>期內售出</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px' }}>帳面銷售</th>
                    <th style={{ textAlign: 'center', padding: '10px 6px' }}>匿名比</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px' }}>累積缺口</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px' }}>上次盤點</th>
                    <th style={{ textAlign: 'right', padding: '10px 6px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map(r => (
                    <tr key={r.venueId + r.productId} className="hs-row" style={{ borderBottom: '1px solid #f5f4f0' }}>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[r.venueId] ?? '#aaa', marginRight: 6 }} />
                        <strong>{r.venueName}</strong>
                        <span style={{ color: '#666', marginLeft: 6 }}>· {r.productName}</span>
                        <span style={{ color: '#aaa', marginLeft: 6, fontSize: 11 }}>${r.unitPrice}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.currentStock <= r.lowStockThreshold
                          ? <span style={{ color: '#e85d3a', fontWeight: 600 }}>{r.currentStock} ⚠</span>
                          : r.currentStock}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#666' }}>
                        {r.totalSoldQty} 罐 / {r.saleCount} 筆
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <Money value={r.totalRevenue} />
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        {r.anonymousRatio >= overview.anonymousRatioThreshold
                          ? <Badge color="red">{(r.anonymousRatio * 100).toFixed(0)}%</Badge>
                          : r.anonymousRatio >= 0.3
                          ? <Badge color="yellow">{(r.anonymousRatio * 100).toFixed(0)}%</Badge>
                          : <Badge color="gray">{(r.anonymousRatio * 100).toFixed(0)}%</Badge>}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        {r.cumulativeDiscrepancy !== 0
                          ? <Money value={r.cumulativeDiscrepancy} danger />
                          : <span style={{ color: '#aaa' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 6px', fontSize: 11, color: '#888' }}>
                        {r.lastAudit
                          ? `${fmt(r.lastAudit.auditedAt.slice(0, 10))} 缺$${r.lastAudit.cashDiscrepancy}`
                          : '尚未盤點'}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        <button
                          onClick={() => setAuditTarget(r)}
                          style={{
                            padding: '6px 10px', borderRadius: 6, border: '1px solid #1a1917',
                            background: '#1a1917', color: '#fff', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600, marginRight: 4,
                          }}
                        >
                          📊 盤點
                        </button>
                        {r.lastAudit && (
                          <button
                            onClick={() => setHistoryTarget(r)}
                            style={{
                              padding: '6px 10px', borderRadius: 6, border: '1px solid #e8e6e0',
                              background: '#fff', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600,
                            }}
                          >
                            🕒 歷史
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '8px 6px 4px', fontSize: 11, color: '#888', lineHeight: 1.7 }}>
            💡 <strong>匿名比</strong>= 銷售紀錄中 customerId 為 null 的比例。誠實商店投錢箱模式必然有匿名銷售，
            但比例 ≥ {(overview.anonymousRatioThreshold * 100).toFixed(0)}% 視為缺乏問責、需要密集盤點。
            <br />
            💡 <strong>盤點</strong>= 老闆數投錢箱實收 + 庫存實際剩，系統算缺口並自動寫 adjustment 校正庫存。
          </div>
        </Panel>

        {auditTarget && (
          <AuditModal
            target={auditTarget}
            onClose={() => setAuditTarget(null)}
          />
        )}

        {historyTarget && (
          <HistoryModal
            target={historyTarget}
            onClose={() => setHistoryTarget(null)}
          />
        )}
      </div>
    </div>
  )
}


// ── 盤點 modal ───────────────────────────────────────────────

function AuditModal({
  target, onClose,
}: {
  target: HonestShopVenueProductSummary
  onClose: () => void
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => previewBoxAudit({
    venueId: target.venueId,
    productId: target.productId,
  }), [target.venueId, target.productId])

  const [countedCash, setCountedCash] = useState<string>(String(preview.expectedRevenue))
  const [countedStock, setCountedStock] = useState<string>(String(preview.currentStock))
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ cashDiff: number; stockDiff: number } | null>(null)

  const cashNum  = Number(countedCash)
  const stockNum = Number(countedStock)
  const cashDiff  = isNaN(cashNum)  ? 0 : preview.expectedRevenue - cashNum
  const stockDiff = isNaN(stockNum) ? 0 : preview.currentStock    - stockNum

  function submit() {
    if (isNaN(cashNum) || isNaN(stockNum)) {
      setErr('請輸入有效數字')
      return
    }
    setSubmitting(true)
    setErr(null)
    const result = recordBoxAudit({
      venueId: target.venueId,
      productId: target.productId,
      countedCash: cashNum,
      countedStock: stockNum,
      notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (!result.ok) {
      setErr(result.reason)
      return
    }
    setDone({ cashDiff: result.cashDiscrepancy, stockDiff: result.stockDiscrepancy })
  }

  if (done) {
    return (
      <ModalShell onClose={onClose} title="✓ 盤點完成">
        <div style={{ padding: '12px 0' }}>
          <div style={{ fontSize: 14, marginBottom: 12, color: '#666' }}>
            {target.venueName} · {target.productName} · 盤點期間 {preview.periodStart} → {preview.periodEnd}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <ResultRow label="帳面銷售" value={`$${preview.expectedRevenue.toLocaleString()}`} />
            <ResultRow label="實收（您數到的）" value={`$${cashNum.toLocaleString()}`} />
            <ResultRow
              label="缺口"
              value={done.cashDiff > 0
                ? `−$${done.cashDiff.toLocaleString()}（少收）`
                : done.cashDiff < 0
                ? `+$${(-done.cashDiff).toLocaleString()}（多收）`
                : '$0（齊）'}
              valueColor={done.cashDiff > 0 ? '#e85d3a' : done.cashDiff < 0 ? '#5b21b6' : '#10b981'}
              bold
            />
            <div style={{ borderTop: '1px solid #f0ede6', paddingTop: 10 }} />
            <ResultRow label="帳面庫存" value={`${preview.currentStock} 罐`} />
            <ResultRow label="實際庫存（您數到的）" value={`${stockNum} 罐`} />
            <ResultRow
              label="庫存差異"
              value={done.stockDiff > 0
                ? `−${done.stockDiff} 罐（已自動校正）`
                : done.stockDiff < 0
                ? `+${-done.stockDiff} 罐（已自動校正）`
                : '0 罐（齊）'}
              valueColor={done.stockDiff > 0 ? '#e85d3a' : done.stockDiff < 0 ? '#5b21b6' : '#10b981'}
            />
          </div>
          <div style={{ padding: '10px 12px', background: '#f5f4f0', borderRadius: 8, fontSize: 12, color: '#666', lineHeight: 1.7 }}>
            ✓ 已寫入盤點記錄（可在「🕒 歷史」查看）<br />
            {done.stockDiff !== 0 && <>✓ 已自動產生 adjustment 商品異動校正庫存<br /></>}
            ✓ 已寫入 audit log
          </div>
          <button
            onClick={onClose}
            style={{
              width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 8,
              border: 'none', background: '#1a1917', color: '#fff',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            關閉
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose} title={`📊 ${target.venueName} · ${target.productName} 盤點`}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
        盤點期間 <strong>{preview.periodStart}</strong> → <strong>{preview.periodEnd}</strong>
        （{preview.saleCount} 筆 sale，匿名 {preview.anonymousCount} 筆）
      </div>

      <div style={{ background: '#f5f4f0', padding: '12px 14px', borderRadius: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#666' }}>系統帳面銷售</span>
          <strong style={{ fontSize: 18 }}>${preview.expectedRevenue.toLocaleString()}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666' }}>系統帳面庫存</span>
          <strong style={{ fontSize: 14 }}>{preview.currentStock} 罐</strong>
        </div>
      </div>

      <FormField label="💵 投錢箱實收金額（NT$）">
        <input
          type="number"
          value={countedCash}
          onChange={e => setCountedCash(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #e8e6e0', fontSize: 16, outline: 'none',
            boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
          }}
        />
        {!isNaN(cashNum) && cashDiff !== 0 && (
          <div style={{
            marginTop: 6, padding: '6px 10px', borderRadius: 6,
            background: cashDiff > 0 ? '#fee2e2' : '#ede9fe',
            color: cashDiff > 0 ? '#991b1b' : '#5b21b6',
            fontSize: 12, fontWeight: 600,
          }}>
            {cashDiff > 0
              ? `⚠️ 缺口 $${cashDiff.toLocaleString()}（疑似有人拿走沒投錢）`
              : `ℹ️ 多收 $${(-cashDiff).toLocaleString()}（有人多投？）`}
          </div>
        )}
      </FormField>

      <FormField label="📦 實際庫存（罐）">
        <input
          type="number"
          value={countedStock}
          onChange={e => setCountedStock(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #e8e6e0', fontSize: 16, outline: 'none',
            boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
          }}
        />
        {!isNaN(stockNum) && stockDiff !== 0 && (
          <div style={{
            marginTop: 6, padding: '6px 10px', borderRadius: 6,
            background: stockDiff > 0 ? '#fef3c7' : '#ede9fe',
            color: stockDiff > 0 ? '#92400e' : '#5b21b6',
            fontSize: 12, fontWeight: 600,
          }}>
            {stockDiff > 0
              ? `📉 損耗 ${stockDiff} 罐（拿了沒登記？）`
              : `📈 多 ${-stockDiff} 罐（補貨未登？）`}
          </div>
        )}
      </FormField>

      <FormField label="備註（可選）">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="例：週末盤點"
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid #e8e6e0', fontSize: 13, outline: 'none',
            boxSizing: 'border-box', resize: 'vertical',
          }}
        />
      </FormField>

      {err && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', padding: '8px 10px',
          borderRadius: 8, fontSize: 12, marginBottom: 10,
        }}>
          ⚠️ {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 8,
            border: '1px solid #e8e6e0', background: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            flex: 2, padding: '10px 0', borderRadius: 8,
            border: 'none', background: '#1a1917', color: '#fff',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {submitting ? '寫入中…' : '確認盤點'}
        </button>
      </div>
    </ModalShell>
  )
}


// ── 歷史 modal ───────────────────────────────────────────────

function HistoryModal({
  target, onClose,
}: {
  target: HonestShopVenueProductSummary
  onClose: () => void
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const audits = useMemo(() => listBoxAudits(target.venueId, target.productId), [target.venueId, target.productId])

  return (
    <ModalShell onClose={onClose} title={`🕒 ${target.venueName} · ${target.productName} 盤點歷史`}>
      {audits.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          無盤點記錄
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {audits.map(a => (
            <div key={a.id}>
              <AuditHistoryRow audit={a} />
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onClose}
        style={{
          width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 8,
          border: '1px solid #e8e6e0', background: '#fff',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}
      >
        關閉
      </button>
    </ModalShell>
  )
}

function AuditHistoryRow({ audit }: { audit: BoxAuditRecord }) {
  const date = new Date(audit.auditedAt)
  return (
    <div style={{
      padding: 12, background: '#fafaf7', borderRadius: 8,
      border: '1px solid #e8e6e0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong style={{ fontSize: 13 }}>
          {date.getFullYear()}/{date.getMonth() + 1}/{date.getDate()} {String(date.getHours()).padStart(2, '0')}:{String(date.getMinutes()).padStart(2, '0')}
        </strong>
        {audit.cashDiscrepancy > 0
          ? <Badge color="red">缺 ${audit.cashDiscrepancy}</Badge>
          : audit.cashDiscrepancy < 0
          ? <Badge color="purple">多 ${-audit.cashDiscrepancy}</Badge>
          : <Badge color="green">齊</Badge>}
      </div>
      <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6 }}>
        期間 {audit.periodStart} → {audit.periodEnd}<br />
        帳面 ${audit.expectedRevenue} · 實收 ${audit.countedCash} · 實庫 {audit.countedStock} 罐
        {audit.notes && <><br />💬 {audit.notes}</>}
      </div>
    </div>
  )
}


// ── 共用：modal shell / form field / result row ─────────────

function ModalShell({
  children, title, onClose,
}: {
  children: React.ReactNode
  title: string
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: 22,
          maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#1a1917' }}>{label}</div>
      {children}
    </div>
  )
}

function ResultRow({
  label, value, valueColor, bold,
}: {
  label: string
  value: string
  valueColor?: string
  bold?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ color: valueColor ?? '#1a1917', fontWeight: bold ? 700 : 500, fontSize: bold ? 16 : 13 }}>
        {value}
      </span>
    </div>
  )
}
