'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getCurrentVisibleVenueIds,
  getProductTransferOverview,
  createProductTransfer,
  shipProductTransfer,
  receiveProductTransfer,
  cancelProductTransfer,
  listVenues,
  listAllEvidence,
  getCurrentUser,
  type ProductTransferRow,
  type TransferSuggestion,
} from '@/data/api'
import { useStoreSync, hydrateStore } from '@/data/store'
import { Badge, VENUE_COLOR } from '@/components/reconciliation/Common'
import { GENERATED } from '@/data/generator'
// 階段 9：型別直接從 '@/types' import（不再經 '@/data/api' 的 re-export）
import type { ProductTransferStatus, ConflictResult, UploadedEvidence } from '@/types'
import ConflictBanner from '@/components/ConflictBanner'
import EvidenceUpload from '@/components/EvidenceUpload'
import EvidencePreview from '@/components/EvidencePreview'


// ── 顯示 helpers ─────────────────────────────────────────────

const STATUS_BADGE: Record<ProductTransferStatus, 'yellow' | 'blue' | 'green' | 'gray'> = {
  pending: 'yellow', in_transit: 'blue', completed: 'green', cancelled: 'gray',
}

const SEVERITY_BG: Record<TransferSuggestion['severity'], { bg: string; border: string; fg: string }> = {
  high:   { bg: '#fee2e2', border: '#fca5a5', fg: '#991b1b' },
  medium: { bg: '#fff3cd', border: '#fde68a', fg: '#92400e' },
  low:    { bg: '#fafaf7', border: '#e8e6e0', fg: '#666' },
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}


// ════════════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════════════

export default function ProductTransfersPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    hydrateStore()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overview = useMemo(() => getProductTransferOverview(visible), [visible, sv])

  const [filter, setFilter] = useState<'active' | 'all' | 'history'>('active')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createPrefill, setCreatePrefill] = useState<TransferSuggestion | null>(null)

  const filteredTransfers = useMemo(() => {
    if (filter === 'active') return overview.transfers.filter(t => t.status === 'pending' || t.status === 'in_transit')
    if (filter === 'history') return overview.transfers.filter(t => t.status === 'completed' || t.status === 'cancelled')
    return overview.transfers
  }, [overview.transfers, filter])

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .xfer-wrap   { padding-top: 64px !important; }
          .xfer-stats  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .xfer-row:hover { background: #fafaf7 !important; }
      `}</style>

      <div className="xfer-wrap" style={{ paddingTop: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Link href="/products" style={{ fontSize: 12, color: '#666', textDecoration: 'none', marginBottom: 4, display: 'inline-block' }}>
              ← 商品管理
            </Link>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 0' }}>跨館調貨</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
              庫存低館從高庫存館調來，自動寫 adjustment Tx + audit
            </p>
          </div>
          <button
            onClick={() => { setCreatePrefill(null); setShowCreateModal(true) }}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none',
              background: '#1a1917', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            ＋ 新增調貨
          </button>
        </div>

        {/* KPI */}
        <div className="xfer-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <KpiCard label="待處理" value={overview.pendingCount} sub="等待出貨" accent="#d97706" />
          <KpiCard label="運送中" value={overview.inTransitCount} sub="等待收貨" accent="#2563eb" />
          <KpiCard label="本月完成" value={overview.completedThisMonthCount} sub={`累計 ${overview.totalQuantityCompleted} 件`} accent="#10b981" />
          <KpiCard label="智能建議" value={overview.suggestions.length} sub="低/高庫存配對" accent="#7c6af7" />
        </div>

        {/* 智能建議 */}
        {overview.suggestions.length > 0 && (
          <SuggestionPanel
            suggestions={overview.suggestions}
            onAdopt={(s) => { setCreatePrefill(s); setShowCreateModal(true) }}
          />
        )}

        {/* 過濾按鈕 + 表格 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: '#f5f4f0', borderRadius: 10, padding: 4 }}>
            {[
              { v: 'active' as const, label: `進行中 (${overview.pendingCount + overview.inTransitCount})` },
              { v: 'history' as const, label: `歷史 (${overview.transfers.length - overview.pendingCount - overview.inTransitCount})` },
              { v: 'all' as const, label: `全部 (${overview.transfers.length})` },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setFilter(opt.v)}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  background: filter === opt.v ? '#fff' : 'transparent',
                  color:      filter === opt.v ? '#1a1917' : '#888',
                  boxShadow:  filter === opt.v ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <TransfersTable transfers={filteredTransfers} />

        {showCreateModal && (
          <CreateTransferModal
            prefill={createPrefill}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    </div>
  )
}


// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      border: '1px solid #e8e6e0', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1, color: '#1a1917' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{sub}</div>}
      {accent && (
        <div style={{ position: 'absolute', top: 14, right: 14, width: 4, height: 32, borderRadius: 2, background: accent }} />
      )}
    </div>
  )
}


// ── 智能建議面板 ─────────────────────────────────────────────

function SuggestionPanel({
  suggestions, onAdopt,
}: {
  suggestions: TransferSuggestion[]
  onAdopt: (s: TransferSuggestion) => void
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
      padding: '14px 16px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        智能建議：根據各館庫存自動配對
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {suggestions.map(s => {
          const c = SEVERITY_BG[s.severity]
          return (
            <div
              key={s.fromVenueId + s.toVenueId + s.productId}
              style={{
                padding: 12, background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ fontSize: 13, color: c.fg, fontWeight: 600 }}>
                {s.severity === 'high' ? '🚨 緊急' : s.severity === 'medium' ? '⚠️ 警示' : '💡 建議'}
                <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 11 }}>{s.productName}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[s.fromVenueId] ?? '#aaa', marginRight: 6 }} />
                <strong>{s.fromVenueName}</strong>
                <span style={{ color: '#888', fontSize: 11 }}>（{s.fromStock}）</span>
                <span style={{ color: '#666', margin: '0 6px' }}>→</span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[s.toVenueId] ?? '#aaa', marginRight: 6 }} />
                <strong>{s.toVenueName}</strong>
                <span style={{ color: '#888', fontSize: 11 }}>（{s.toStock}）</span>
              </div>
              <div style={{ fontSize: 12, color: c.fg }}>
                建議調撥 <strong>{s.suggestedQty}</strong> 件
              </div>
              <button
                onClick={() => onAdopt(s)}
                style={{
                  padding: '6px 10px', borderRadius: 6, border: 'none',
                  background: '#1a1917', color: '#fff', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, alignSelf: 'flex-start',
                }}
              >
                ✓ 採納建議
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── 調貨表格 ──────────────────────────────────────────────────

function TransfersTable({ transfers }: { transfers: ProductTransferRow[] }) {
  if (transfers.length === 0) {
    return (
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
        padding: '40px 0', textAlign: 'center', color: '#aaa', fontSize: 13,
      }}>
        無調貨單記錄
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0ede6', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <th style={{ textAlign: 'center', padding: '12px 10px' }}>狀態</th>
              <th style={{ textAlign: 'left',  padding: '12px 10px' }}>商品 / 數量</th>
              <th style={{ textAlign: 'left',  padding: '12px 10px' }}>出貨館</th>
              <th style={{ textAlign: 'left',  padding: '12px 10px' }}>入貨館</th>
              <th style={{ textAlign: 'left',  padding: '12px 10px' }}>申請者</th>
              <th style={{ textAlign: 'left',  padding: '12px 10px' }}>時間</th>
              <th style={{ textAlign: 'right', padding: '12px 10px' }}>動作</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map(t => (
              <TransferRow key={t.id} transfer={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ── 單筆調貨 row（含樂觀鎖 + 簽收照） ────────────────────────

function TransferRow({ transfer }: { key?: string | number; transfer: ProductTransferRow }) {
  // 階段 9：每張 transfer card 各自的 baseUpdatedAt snapshot + conflict 狀態
  // 雙開分頁、多人同時管出貨/收貨 等場景的樂觀鎖保護
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(transfer.updatedAt)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  useEffect(() => {
    if (!conflict && transfer.updatedAt !== baseUpdatedAt) {
      setBaseUpdatedAt(transfer.updatedAt)
    }
  }, [transfer.updatedAt, conflict, baseUpdatedAt])
  const reloadSnapshot = () => {
    setConflict(null)
    setBaseUpdatedAt(transfer.updatedAt)
  }

  // 簽收照 UI 展開/收合
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  return (
    <>
      <tr className="xfer-row" style={{ borderBottom: conflict ? 'none' : '1px solid #f5f4f0' }}>
        <td style={{ padding: '10px', textAlign: 'center' }}>
          <Badge color={STATUS_BADGE[transfer.status]}>{transfer.statusLabel}</Badge>
        </td>
        <td style={{ padding: '10px' }}>
          <strong>{transfer.productName}</strong>
          <span style={{ color: '#666', marginLeft: 6 }}>× {transfer.quantity}</span>
          {transfer.notes && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>💬 {transfer.notes}</div>}
        </td>
        <td style={{ padding: '10px' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[transfer.fromVenueId] ?? '#aaa', marginRight: 6 }} />
          {transfer.fromVenueName}
          <div style={{ fontSize: 10, color: '#aaa' }}>剩 {transfer.fromVenueCurrentStock}</div>
        </td>
        <td style={{ padding: '10px' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[transfer.toVenueId] ?? '#aaa', marginRight: 6 }} />
          {transfer.toVenueName}
          <div style={{ fontSize: 10, color: '#aaa' }}>剩 {transfer.toVenueCurrentStock}</div>
        </td>
        <td style={{ padding: '10px', fontSize: 12, color: '#666' }}>
          {transfer.requestedByName}
        </td>
        <td style={{ padding: '10px', fontSize: 11, color: '#888' }}>
          申請 {fmtTime(transfer.requestedAt)}
          {transfer.completedAt && <div>完成 {fmtTime(transfer.completedAt)}</div>}
        </td>
        <td style={{ padding: '10px', textAlign: 'right' }}>
          <TransferActionButtons
            transfer={transfer}
            baseUpdatedAt={baseUpdatedAt}
            onConflict={setConflict}
            evidenceOpen={evidenceOpen}
            onToggleEvidence={() => setEvidenceOpen(o => !o)}
          />
        </td>
      </tr>

      {/* 衝突 banner（橫跨整列） */}
      {conflict && (
        <tr style={{ borderBottom: '1px solid #f5f4f0' }}>
          <td colSpan={7} style={{ padding: '8px 10px', background: '#fff' }}>
            <ConflictBanner conflict={conflict} onReload={reloadSnapshot} />
          </td>
        </tr>
      )}

      {/* 簽收照展開區（橫跨整列） */}
      {evidenceOpen && (
        <tr style={{ borderBottom: '1px solid #f5f4f0' }}>
          <td colSpan={7} style={{ padding: '12px', background: '#fafaf7' }}>
            <TransferEvidenceSection transfer={transfer} />
          </td>
        </tr>
      )}
    </>
  )
}


// ── 動作按鈕 ──────────────────────────────────────────────────

function TransferActionButtons({
  transfer, baseUpdatedAt, onConflict, evidenceOpen, onToggleEvidence,
}: {
  transfer: ProductTransferRow
  baseUpdatedAt: string
  onConflict: (c: ConflictResult) => void
  evidenceOpen: boolean
  onToggleEvidence: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 統一處理 mutation 結果：成功 / 一般錯誤 / 樂觀鎖衝突
  function handleResult(r: { ok: true } | { ok: false; reason: string } | ConflictResult) {
    setBusy(false)
    if (r.ok) return
    if ('conflict' in r && r.conflict) {
      onConflict(r as ConflictResult)
      return
    }
    setErr(r.reason)
  }

  function doShip() {
    setBusy(true); setErr(null)
    handleResult(shipProductTransfer(transfer.id, { baseUpdatedAt }))
  }
  function doReceive() {
    setBusy(true); setErr(null)
    handleResult(receiveProductTransfer(transfer.id, { baseUpdatedAt }))
  }
  function doCancel() {
    if (transfer.status === 'in_transit' && !confirm(`已運送中。取消後 ${transfer.fromVenueName} 已扣的庫存不會自動補回，要另開逆向調貨。確定取消？`)) return
    const reason = prompt('取消原因（可留白）') ?? undefined
    setBusy(true); setErr(null)
    handleResult(cancelProductTransfer(transfer.id, reason, { baseUpdatedAt }))
  }

  const isTerminal = transfer.status === 'completed' || transfer.status === 'cancelled'

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
      {/* 簽收照按鈕（任何狀態都可開，已完成的也能看歷史） */}
      <button
        type="button"
        onClick={onToggleEvidence}
        style={{
          padding: '5px 9px', borderRadius: 6, border: '1px solid #e8e6e0',
          background: evidenceOpen ? '#f5f4f0' : '#fff',
          cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#666',
        }}
        title="調貨簽收照"
      >
        📷
      </button>
      {transfer.status === 'pending' && (
        <button onClick={doShip} disabled={busy} style={btnStyle('#2563eb')}>
          📦 出貨
        </button>
      )}
      {transfer.status === 'in_transit' && (
        <button onClick={doReceive} disabled={busy} style={btnStyle('#10b981')}>
          ✓ 收貨
        </button>
      )}
      {!isTerminal && (
        <button
          onClick={doCancel}
          disabled={busy}
          style={{
            padding: '5px 9px', borderRadius: 6, border: '1px solid #e8e6e0',
            background: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
            fontSize: 11, fontWeight: 600, color: '#666',
          }}
        >
          取消
        </button>
      )}
      {isTerminal && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>—</span>}
      {err && (
        <div style={{
          position: 'absolute', background: '#fee2e2', color: '#991b1b',
          padding: '4px 8px', borderRadius: 6, fontSize: 11, marginTop: 26, right: 16, zIndex: 10,
        }}>
          ⚠️ {err}
        </div>
      )}
    </div>
  )
}


// ── 簽收照展開區 ─────────────────────────────────────────────
// 階段 9：把 EvidenceUpload 接在每張 transfer card 下面（sourceType='transfer'）
// - in_transit / completed：顯示已上傳清單（縮圖） + 「再傳一張」
// - pending / cancelled：唯讀（pending 沒簽收意義、cancelled 是死案）

function TransferEvidenceSection({ transfer }: { transfer: ProductTransferRow }) {
  const sv = useStoreSync()
  const me = getCurrentUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const evidenceList: UploadedEvidence[] = useMemo(
    () => listAllEvidence({ sourceType: 'transfer', sourceId: transfer.id }),
    [transfer.id, sv],
  )
  const canUpload = transfer.status === 'in_transit' || transfer.status === 'completed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
        📦 調貨簽收照（{transfer.fromVenueName} → {transfer.toVenueName} · {transfer.productName} × {transfer.quantity}）
      </div>

      {/* 已上傳清單 */}
      {evidenceList.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {evidenceList.map(e => (
            <div key={e.id} style={{
              border: '1px solid #e8e6e0', borderRadius: 8, padding: 6,
              background: '#fff', display: 'flex', flexDirection: 'column', gap: 4,
              maxWidth: 120,
            }}>
              <EvidencePreview value={e.id} size={108} showFilename={false} />
              <div style={{ fontSize: 10, color: '#888', wordBreak: 'break-all' }}>
                {e.filename}
              </div>
              <div style={{ fontSize: 10, color: '#aaa' }}>
                {(e.size / 1024).toFixed(1)} KB · {e.uploadedByName}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#aaa' }}>尚未上傳簽收照</div>
      )}

      {/* 上傳元件 */}
      {canUpload ? (
        <div style={{ marginTop: 4 }}>
          <EvidenceUpload
            sourceType="transfer"
            sourceId={transfer.id}
            uploadedByName={me?.name ?? '員工'}
            onUploaded={() => { /* store notify 會觸發 re-render */ }}
            buttonLabel="上傳簽收照"
          />
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#aaa' }}>
          {transfer.status === 'pending' ? '出貨前無需簽收照' : '已取消的調貨無法新增簽收照'}
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '5px 9px', borderRadius: 6, border: 'none',
    background: bg, color: '#fff', cursor: 'pointer',
    fontSize: 11, fontWeight: 600,
  }
}


// ── 新增調貨 modal ───────────────────────────────────────────

function CreateTransferModal({
  prefill, onClose,
}: {
  prefill: TransferSuggestion | null
  onClose: () => void
}) {
  // 列出所有商品 + 各館庫存
  const products = useMemo(() => GENERATED.products, [])
  const venues = useMemo(() => listVenues().filter(v => v.isActive), [])

  const [productId, setProductId] = useState(prefill?.productId ?? products[0]?.id ?? '')
  const [fromVenueId, setFromVenueId] = useState(prefill?.fromVenueId ?? '')
  const [toVenueId, setToVenueId] = useState(prefill?.toVenueId ?? '')
  const [quantity, setQuantity] = useState(String(prefill?.suggestedQty ?? 1))
  const [notes, setNotes] = useState(prefill ? '智能建議採納' : '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 列出此商品在各館的庫存（給選 from/to 看）
  const stocks = useMemo(() => {
    const productName = products.find(p => p.id === productId)?.name
    return venues.map(v => {
      const vpEntry = GENERATED.venueProducts.find(vp => vp.venueId === v.id)
      const vp = vpEntry?.products.find(p => p.name === productName)
      return {
        venueId: v.id,
        venueName: v.name,
        stock: vp?.currentStock ?? 0,
        hasProduct: !!vp,
      }
    })
  }, [productId, products, venues])

  function submit() {
    setSubmitting(true); setErr(null)
    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) {
      setErr('數量必須是正整數'); setSubmitting(false); return
    }
    const r = createProductTransfer({
      productId, fromVenueId, toVenueId, quantity: qty, notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (!r.ok) { setErr(r.reason); return }
    onClose()
  }

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
          maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          📦 新增跨館調貨
        </div>

        {/* 商品選擇 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>商品</div>
          <select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            style={selStyle}
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}（${p.unitPrice}）</option>
            ))}
          </select>
        </div>

        {/* 各館庫存提示 */}
        <div style={{
          background: '#f5f4f0', padding: '8px 10px', borderRadius: 8,
          marginBottom: 14, fontSize: 11, color: '#666',
        }}>
          各館庫存：{stocks.map(s => `${s.venueName} ${s.stock}`).join(' · ')}
        </div>

        {/* From / To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>出貨館（庫存高）</div>
            <select
              value={fromVenueId}
              onChange={e => setFromVenueId(e.target.value)}
              style={selStyle}
            >
              <option value="">選擇…</option>
              {stocks.filter(s => s.hasProduct && s.venueId !== toVenueId).map(s => (
                <option key={s.venueId} value={s.venueId}>{s.venueName}（庫存 {s.stock}）</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>入貨館（庫存低）</div>
            <select
              value={toVenueId}
              onChange={e => setToVenueId(e.target.value)}
              style={selStyle}
            >
              <option value="">選擇…</option>
              {stocks.filter(s => s.hasProduct && s.venueId !== fromVenueId).map(s => (
                <option key={s.venueId} value={s.venueId}>{s.venueName}（庫存 {s.stock}）</option>
              ))}
            </select>
          </div>
        </div>

        {/* 數量 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>數量</div>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            min="1"
            style={inputStyle}
          />
        </div>

        {/* 備註 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>備註（可選）</div>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="例：週末活動補貨"
            style={inputStyle}
          />
        </div>

        {err && (
          <div style={{
            background: '#fee2e2', color: '#991b1b', padding: '8px 10px',
            borderRadius: 8, fontSize: 12, marginBottom: 10,
          }}>
            ⚠️ {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
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
            disabled={submitting || !fromVenueId || !toVenueId || !quantity}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8,
              border: 'none', background: '#1a1917', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
              opacity: (!fromVenueId || !toVenueId || !quantity) ? 0.5 : 1,
            }}
          >
            {submitting ? '建立中…' : '建立調貨單（pending）'}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: '#888', lineHeight: 1.7 }}>
          💡 建立後狀態為 <strong>pending</strong>，需在表格中按「📦 出貨」進入 in_transit，
          再按「✓ 收貨」完成。每階段自動寫 adjustment Tx + audit log。
        </div>
      </div>
    </div>
  )
}

const selStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e8e6e0', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e8e6e0', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
}
