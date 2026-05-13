'use client'

import { useEffect, useState } from 'react'
import { getEvidenceObjectUrl, isEvidenceId, getEvidenceMeta } from '@/data/api'

/**
 * 憑證縮圖顯示元件（階段 8）。
 *
 * 行為分流：
 *   1. value 是 `evd_xxx` 格式 → 從 IndexedDB 取 blob，顯示縮圖
 *      - 找不到 blob → 顯示「檔案已遺失」灰底
 *      - meta 已標記 blobAvailable=false → 顯示「已刪除」
 *   2. value 是 legacy 字串（檔名 / URL）→ 純文字 chip 顯示
 *   3. value 是 null / undefined / '' → 不 render
 *
 * caller 端在 unmount 時自動 revoke object URL（避免記憶體洩漏）。
 */
export default function EvidencePreview({
  value,
  size = 80,
  showFilename = true,
}: {
  key?: string | number
  value: string | null | undefined
  /** 縮圖正方形邊長 px */
  size?: number
  /** 圖片下方是否顯示檔名 */
  showFilename?: boolean
}) {
  const [src, setSrc]         = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)

  // 偵測 value 類型
  const looksLikeId = isEvidenceId(value ?? null)
  const meta = looksLikeId ? getEvidenceMeta(value!) : null

  // 載 blob（只有真是 evidence id 且 meta 存在且 blob 還在時）
  useEffect(() => {
    if (!looksLikeId || !meta || !meta.blobAvailable) return
    let cancelled = false
    let url: string | null = null

    setLoading(true)
    setMissing(false)
    getEvidenceObjectUrl(value!).then(u => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u)
        return
      }
      url = u
      setLoading(false)
      if (u) setSrc(u)
      else setMissing(true)
    })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [value, looksLikeId, meta])

  if (!value) return null

  // ── case 2：legacy 字串（不是 evd_ 前綴）→ 純文字 chip
  if (!looksLikeId) {
    return (
      <span
        title={`legacy 字串憑證：${value}`}
        style={{
          display: 'inline-block',
          padding: '4px 8px',
          background: '#f5f4f0',
          border: '1px dashed #c8c5bc',
          borderRadius: 6,
          fontSize: 11,
          color: '#666',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        📎 {value}
      </span>
    )
  }

  // ── case 1.x：evidence id
  const box: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  }
  const square: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 8,
    border: '1px solid #e8e6e0',
    background: '#fafaf7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 1.3,
  }

  // meta 不存在 → 怪資料
  if (!meta) {
    return (
      <span style={box}>
        <span style={{ ...square, color: '#b91c1c', background: '#fee2e2' }}>
          ⚠️<br />meta 不存在
        </span>
      </span>
    )
  }

  // meta 已標記刪除
  if (!meta.blobAvailable) {
    return (
      <span style={box}>
        <span style={{ ...square, color: '#888', background: '#f5f4f0' }}>
          🗑<br />已刪除
        </span>
        {showFilename && (
          <span style={{ fontSize: 10, color: '#999', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta.filename}
          </span>
        )}
      </span>
    )
  }

  // blob 找不到（瀏覽器清資料？）
  if (missing) {
    return (
      <span style={box}>
        <span style={{ ...square, color: '#b91c1c', background: '#fef3c7' }}>
          ⚠️<br />blob 遺失
        </span>
        {showFilename && (
          <span style={{ fontSize: 10, color: '#999', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta.filename}
          </span>
        )}
      </span>
    )
  }

  // 載入中
  if (loading || !src) {
    return (
      <span style={box}>
        <span style={square}>載入中…</span>
        {showFilename && (
          <span style={{ fontSize: 10, color: '#999', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta.filename}
          </span>
        )}
      </span>
    )
  }

  // 正常顯示
  return (
    <span style={box}>
      <a href={src} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
        <img
          src={src}
          alt={meta.filename}
          style={{ ...square, padding: 0, objectFit: 'cover' }}
        />
      </a>
      {showFilename && (
        <span style={{ fontSize: 10, color: '#666', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta.filename}
        </span>
      )}
    </span>
  )
}
