'use client'

import { useEffect, useRef, useState } from 'react'
import {
  uploadEvidence, isEvidenceStoreAvailable,
  type EvidenceSourceType,
} from '@/data/api'

/**
 * 憑證上傳元件（階段 8）。
 *
 * 行為：
 *   1. 預設狀態：顯示「選擇圖片」按鈕
 *   2. 選了檔：顯示縮圖預覽 + 檔名 + 大小 + 「上傳」/「換一張」按鈕
 *   3. 上傳中：disabled
 *   4. 上傳完成：呼叫 onUploaded(id)；自身保留顯示縮圖（變灰）
 *
 * 父元件控制是否多次上傳；本元件單次上傳完不自動 reset，
 * 由父元件決定要不要保留狀態或讓使用者「換一張」再上傳。
 *
 * 不支援 IndexedDB 的環境 → 自動 fallback 為「不顯示元件」並
 * 給父層 onUnavailable callback（讓父層顯示 legacy text input）。
 */
export default function EvidenceUpload({
  sourceType,
  sourceId,
  uploadedByName,
  onUploaded,
  onError,
  onUnavailable,
  accept = 'image/*',
  buttonLabel = '選擇圖片',
}: {
  sourceType: EvidenceSourceType
  sourceId: string
  uploadedByName: string
  onUploaded: (id: string, meta: { filename: string; size: number }) => void
  onError?: (reason: string) => void
  onUnavailable?: () => void
  accept?: string
  buttonLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded,  setUploaded]  = useState(false)
  const [localErr,  setLocalErr]  = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)

  // SSR-safe 偵測 IndexedDB 可用性
  useEffect(() => {
    const ok = isEvidenceStoreAvailable()
    setAvailable(ok)
    if (!ok) onUnavailable?.()
  }, [onUnavailable])

  // 換檔時釋放舊 previewUrl（避免洩漏）
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setLocalErr(null)
    setUploaded(false)
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setUploaded(false)
    setLocalErr(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function doUpload() {
    if (!file) return
    setUploading(true)
    setLocalErr(null)
    const result = await uploadEvidence({
      blob: file,
      filename: file.name,
      sourceType,
      sourceId,
      uploadedByName,
    })
    setUploading(false)
    if (!result.ok) {
      setLocalErr(result.reason)
      onError?.(result.reason)
      return
    }
    setUploaded(true)
    onUploaded(result.id, { filename: result.meta.filename, size: result.meta.size })
  }

  // 不支援 IndexedDB → 不顯示
  if (available === false) return null
  if (available === null) {
    return <div style={{ fontSize: 12, color: '#999' }}>檢查上傳支援度…</div>
  }

  const btnStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #e8e6e0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  }
  const primaryBtn: React.CSSProperties = {
    ...btnStyle,
    background: '#1a1917',
    color: '#fff',
    borderColor: '#1a1917',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onPick}
        style={{ display: 'none' }}
        disabled={uploading}
      />

      {!file && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={btnStyle}
          disabled={uploading}
        >
          📷 {buttonLabel}
        </button>
      )}

      {file && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {previewUrl && (
            <img
              src={previewUrl}
              alt={file.name}
              style={{
                width: 80, height: 80, objectFit: 'cover',
                borderRadius: 8, border: '1px solid #e8e6e0',
                opacity: uploaded ? 0.5 : 1,
              }}
            />
          )}
          <div style={{ flex: 1, fontSize: 12, color: '#444' }}>
            <div style={{ fontWeight: 600, marginBottom: 2, wordBreak: 'break-all' }}>
              {file.name}
            </div>
            <div style={{ color: '#888', marginBottom: 6 }}>
              {(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown'}
            </div>

            {!uploaded && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={doUpload}
                  style={primaryBtn}
                  disabled={uploading}
                >
                  {uploading ? '上傳中…' : '上傳'}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  style={btnStyle}
                  disabled={uploading}
                >
                  換一張
                </button>
              </div>
            )}
            {uploaded && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#15803d', fontSize: 12, fontWeight: 600 }}>
                  ✓ 上傳成功
                </span>
                <button
                  type="button"
                  onClick={reset}
                  style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}
                >
                  再傳一張
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {localErr && (
        <div
          style={{
            padding: '6px 10px', borderRadius: 6,
            background: '#fee2e2', color: '#991b1b',
            fontSize: 12,
          }}
        >
          {localErr}
        </div>
      )}
    </div>
  )
}
