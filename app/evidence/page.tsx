'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listAllEvidence, deleteEvidenceById,
  uploadEvidence, isEvidenceStoreAvailable,
  EVIDENCE_SOURCE_LABEL,
  listBoxAudits, listProductTransfers, listWeeklyGoals,
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
 *   - 「生成示範憑證」一鍵 seed：用 Canvas 產 4 種來源（自助回報轉帳 /
 *     盤點現場 / 調貨簽收 / 館長目標完成）各一張 placeholder JPEG
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
      // 四種來源各造一張示範圖。盡量掛到真實單據上（讓 audit 反查得到場館、
      // 對應業務頁也看得到附件）；找不到對應記錄時 fall back 用 demo 假 id
      // （venue 反查回 null，uploadEvidence 仍可正常寫入）。
      const stamp = Date.now()
      const boxAuditId = listBoxAudits()[0]?.id          ?? `ba_demo_seed_${stamp}`
      const transferId = listProductTransfers()[0]?.id   ?? `xfer_demo_seed_${stamp}`
      const goalId     = listWeeklyGoals()[0]?.id        ?? `wg_demo_seed_${stamp}`

      const samples: Array<{
        sourceType: EvidenceSourceType
        sourceId: string
        name: string
        uploadedByName: string
      }> = [
        { sourceType: 'self_payment', sourceId: `r_demo_seed_${stamp}`, name: '示範_轉帳截圖_001.jpg', uploadedByName: '示範顧客' },
        { sourceType: 'box_audit',    sourceId: boxAuditId,             name: '示範_盤點現場_001.jpg', uploadedByName: '示範員工' },
        { sourceType: 'transfer',     sourceId: transferId,             name: '示範_調貨簽收_001.jpg', uploadedByName: '示範員工' },
        { sourceType: 'captain_goal', sourceId: goalId,                 name: '示範_目標完成_001.jpg', uploadedByName: '示範館長' },
      ]

      let created = 0
      for (const s of samples) {
        const blob = await makeSampleEvidenceBlob(s.sourceType)
        if (!blob) continue
        const result = await uploadEvidence({
          blob,
          filename: s.name,
          sourceType: s.sourceType,
          sourceId: s.sourceId,
          uploadedByName: s.uploadedByName,
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
// 依憑證來源類型畫出對應情境的示範圖（轉帳收據 / 盤點現場 / 調貨簽收 / 目標達成）。

function makeSampleEvidenceBlob(kind: EvidenceSourceType): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null)
    const W = 240, H = 320
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return resolve(null)

    // 各來源的主題色 / 標題 / 內文
    const THEME: Record<EvidenceSourceType, { color: string; title: string; lines: string[] }> = {
      self_payment: {
        color: '#16a34a', title: '✓ 轉帳成功',
        lines: ['已付 $500', 'TXN' + Date.now().toString().slice(-9)],
      },
      box_audit: {
        color: '#d97706', title: '🪙 誠實商店盤點',
        lines: ['投錢箱實收 $1,240', '帳面 $1,200 · 差 +$40', '運動飲料 ×18 罐'],
      },
      transfer: {
        color: '#0e7490', title: '📦 調貨簽收單',
        lines: ['Ace 2.0 → 球魔方 2.0', '護膝 ×6 件', '簽收人：王小明'],
      },
      captain_goal: {
        color: '#7c3aed', title: '🎯 本週目標達成',
        lines: ['冷門時段衝刺', '達成率 100%', '7 / 7 場已售出'],
      },
    }
    const t = THEME[kind]

    // 漸層底
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, t.color + '22')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // 模擬收據 / 單據外框
    ctx.fillStyle = '#fff'
    ctx.fillRect(20, 30, 200, 260)
    ctx.strokeStyle = '#e8e6e0'
    ctx.lineWidth = 1
    ctx.strokeRect(20, 30, 200, 260)

    // 標題
    ctx.fillStyle = t.color
    ctx.font = 'bold 17px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(t.title, 120, 68)

    // 分隔線
    ctx.strokeStyle = t.color + '55'
    ctx.beginPath()
    ctx.moveTo(40, 82)
    ctx.lineTo(200, 82)
    ctx.stroke()

    // 內文（依來源）
    ctx.fillStyle = '#444'
    ctx.font = '13px sans-serif'
    t.lines.forEach((ln, i) => ctx.fillText(ln, 120, 112 + i * 26))

    // 假時間
    ctx.fillStyle = '#aaa'
    ctx.font = '11px sans-serif'
    const now = new Date()
    ctx.fillText(
      `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      120, 250,
    )

    // 浮水印
    ctx.fillStyle = '#ccc'
    ctx.font = '10px sans-serif'
    ctx.fillText('（demo 示範圖片）', 120, 280)

    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
  })
}
