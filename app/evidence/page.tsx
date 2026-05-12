'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listAllEvidence, deleteEvidenceById,
  uploadEvidence, isEvidenceStoreAvailable,
  EVIDENCE_SOURCE_LABEL,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { UploadedEvidence, EvidenceSourceType } from '@/types'
import EvidencePreview from '@/components/EvidencePreview'
import RequireRole from '@/components/RequireRole'

/**
 * 上傳憑證列表（階段 8 Part A）。
 *
 * 功能：
 *   - 列出所有 evidence meta + 縮圖
 *   - admin 刪除（會 mark blobAvailable=false 並從 IndexedDB 移除 blob）
 *   - 「生成示範憑證」一鍵 seed：用 Canvas 產 3 個 placeholder JPEG
 *     塞 IndexedDB + meta（demo 首次 load 用，無需網路）
 *
 * 權限：owner only（與 audit 同層級）。
 */
export default function EvidencePage() {
  return (
    <RequireRole page="evidence">
      <EvidenceContent />
    </RequireRole>
  )
}

function EvidenceContent() {
  useStoreSync()
  useEffect(() => { hydrateStore() }, [])

  const [includeDeleted, setIncludeDeleted] = useState<boolean>(false)
  const [sourceFilter, setSourceFilter] = useState<EvidenceSourceType | 'all'>('all')
  const [busy, setBusy] = useState<boolean>(false)
  const [toast, setToast] = useState<string | null>(null)

  const items: UploadedEvidence[] = useMemo<UploadedEvidence[]>(
    () => listAllEvidence({
      sourceType: sourceFilter,
      includeDeleted,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceFilter, includeDeleted, busy, toast],
  )

  const totalSize = items
    .filter((e: UploadedEvidence) => e.blobAvailable)
    .reduce((sum: number, e: UploadedEvidence) => sum + e.size, 0)

  async function onDelete(id: string, filename: string) {
    if (!confirm(`刪除憑證「${filename}」？\n\n會從 IndexedDB 移除 blob，meta 保留供 audit 追蹤。`)) return
    setBusy(true)
    const result = await deleteEvidenceById(id)
    setBusy(false)
    if (!result.ok) {
      alert(`刪除失敗：${result.reason}`)
    } else {
      setToast('已刪除')
      setTimeout(() => setToast(null), 1800)
    }
  }

  async function onSeed() {
    if (!isEvidenceStoreAvailable()) {
      alert('此瀏覽器不支援 IndexedDB')
      return
    }
    setBusy(true)
    try {
      // 用 Canvas 產 3 個小張 placeholder JPEG 塞 IndexedDB
      const samples = [
        { name: '示範轉帳截圖_001.jpg', label: '轉帳完成', color: '#16a34a' },
        { name: '示範轉帳截圖_002.jpg', label: '已付 $500', color: '#0e7490' },
        { name: '示範轉帳截圖_003.jpg', label: 'NT$1,200',   color: '#7c3aed' },
      ]
      let created = 0
      for (const s of samples) {
        const blob = await makeSamplePngBlob(s.label, s.color)
        if (!blob) continue
        // 用 fake registrationId（生成的 id 不會對應真實 registration，但
        // upload audit log 仍可寫；admin 列表會顯示原始 sourceId）
        const fakeRegId = `r_demo_seed_${Date.now()}_${created}`
        const result = await uploadEvidence({
          blob,
          filename: s.name,
          sourceType: 'self_payment',
          sourceId: fakeRegId,
          uploadedByName: '示範資料',
        })
        if (result.ok) created++
      }
      setToast(`已生成 ${created} 筆示範憑證`)
      setTimeout(() => setToast(null), 2200)
    } catch (e) {
      alert(`產生失敗：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.ev-wrap{padding-top:64px !important}}`}</style>
      <div className="ev-wrap" style={{ paddingTop: 0 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>上傳憑證</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
              階段 8 新增｜Blob 存 IndexedDB、meta 隨 localStorage 一起 hydrate
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onSeed}
              disabled={busy}
              style={{
                padding: '6px 12px', fontSize: 12, color: '#1a1917',
                background: '#fff', border: '1px solid #d4d2cc', borderRadius: 6,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              ➕ 生成示範憑證
            </button>
          </div>
        </div>

        {/* Filter 列 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as EvidenceSourceType | 'all')} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0',
            background: '#fff', fontSize: 13, color: '#1a1917',
          }}>
            <option value="all">所有來源</option>
            {Object.entries(EVIDENCE_SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={e => setIncludeDeleted(e.target.checked)}
            />
            含已刪除
          </label>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
            {items.filter((e: UploadedEvidence) => e.blobAvailable).length} 筆有效
            <span style={{ margin: '0 8px', color: '#ccc' }}>·</span>
            總計 {(totalSize / 1024).toFixed(1)} KB
          </div>
        </div>

        {/* 列表 */}
        {items.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center', color: '#999',
            background: '#fafaf7', borderRadius: 12, border: '1px dashed #d4d2cc',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>還沒有任何上傳憑證</div>
            <div style={{ fontSize: 12 }}>
              到無人場次自助回報頁上傳轉帳截圖，或點上方「生成示範憑證」一鍵建立 demo 資料
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {items.map((e: UploadedEvidence) => (
              <EvidenceCard
                key={e.id}
                meta={e}
                onDelete={() => { void onDelete(e.id, e.filename) }}
                disabled={busy as boolean}
              />
            ))}
          </div>
        )}

        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24,
            background: '#1a1917', color: '#fff',
            padding: '10px 16px', borderRadius: 8,
            fontSize: 13, zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 單筆 card ────────────────────────────────────────────────

function EvidenceCard({
  meta, onDelete, disabled,
}: {
  meta: UploadedEvidence
  onDelete: () => void
  disabled: boolean
  /** React.key prop (SSR 環境 React types 不存在時 TS 不會自動 strip) */
  key?: string
}) {
  const time = meta.uploadedAt.slice(0, 16).replace('T', ' ')
  return (
    <div style={{
      background: meta.blobAvailable ? '#fff' : '#f9f8f4',
      border: `1px solid ${meta.blobAvailable ? '#e8e6e0' : '#d4d2cc'}`,
      borderRadius: 10,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      opacity: meta.blobAvailable ? 1 : 0.6,
    }}>
      <div style={{ alignSelf: 'center' }}>
        <EvidencePreview value={meta.id} size={120} showFilename={false} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-all', minHeight: 30 }}>
        {meta.filename}
      </div>
      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>
        <div>👤 {meta.uploadedByName}</div>
        <div>📅 {time}</div>
        <div>📦 {(meta.size / 1024).toFixed(1)} KB · {meta.mimeType.replace('image/', '')}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#aaa', marginTop: 4 }}>
          src: {meta.sourceId.length > 22 ? `${meta.sourceId.slice(0, 22)}…` : meta.sourceId}
        </div>
      </div>
      {meta.blobAvailable ? (
        <button
          onClick={onDelete}
          disabled={disabled}
          style={{
            padding: '6px 10px', fontSize: 11, color: '#991b1b',
            background: '#fff', border: '1px solid #fecaca', borderRadius: 6,
            cursor: disabled ? 'wait' : 'pointer',
          }}
        >
          🗑 刪除
        </button>
      ) : (
        <div style={{ fontSize: 11, color: '#991b1b', textAlign: 'center', padding: '6px 0' }}>
          已刪除（meta 保留供 audit）
        </div>
      )}
    </div>
  )
}

// ── Canvas → JPEG blob helper（純 client、無網路）─────────────

function makeSamplePngBlob(label: string, color: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null)
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    if (!ctx) return resolve(null)

    // 漸層底
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, color + '22')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 模擬轉帳收據外框
    ctx.fillStyle = '#fff'
    ctx.fillRect(20, 30, 200, 260)
    ctx.strokeStyle = '#e8e6e0'
    ctx.lineWidth = 1
    ctx.strokeRect(20, 30, 200, 260)

    // 標題
    ctx.fillStyle = color
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓ 轉帳成功', 120, 70)

    // 內容
    ctx.fillStyle = '#444'
    ctx.font = '14px sans-serif'
    ctx.fillText(label, 120, 130)

    // 假交易序號
    ctx.fillStyle = '#888'
    ctx.font = '11px ui-monospace, monospace'
    const fakeTxnId = 'TXN' + Date.now().toString().slice(-9)
    ctx.fillText(fakeTxnId, 120, 170)

    // 假時間
    ctx.fillStyle = '#aaa'
    ctx.font = '11px sans-serif'
    const now = new Date()
    ctx.fillText(
      `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      120, 200,
    )

    // 浮水印
    ctx.fillStyle = '#ccc'
    ctx.font = '10px sans-serif'
    ctx.fillText('（demo 示範圖片）', 120, 280)

    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
  })
}
