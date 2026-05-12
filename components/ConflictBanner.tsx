'use client'

import type { ConflictResult } from '@/types'

/**
 * 樂觀鎖衝突提示橫幅（階段 8）。
 *
 * 用於頁面層接到 mutation result.conflict===true 時，顯示
 * 「有人在你之前改了這筆」+ 「重新載入」按鈕。
 *
 * 設計：偏向「銳利但不嚇人」— 橘色而非紅色（衝突非錯誤），
 * 內含時間 + 修改者 + 解決動作。
 */
export default function ConflictBanner({
  conflict,
  onReload,
  onDismiss,
}: {
  conflict: ConflictResult
  /** 重新載入動作（通常呼叫 router.refresh 或 setState） */
  onReload: () => void
  /** 關閉橫幅；不傳就不顯示關閉按鈕（強制處理） */
  onDismiss?: () => void
}) {
  const timeStr = conflict.currentUpdatedAt.length >= 19
    ? conflict.currentUpdatedAt.slice(11, 19)
    : conflict.currentUpdatedAt

  return (
    <div
      style={{
        background: '#fff7ed',
        border: '1px solid #fb923c',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
      }}
      role="alert"
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>⚠️</div>
      <div style={{ flex: 1, fontSize: 13, color: '#7c2d12' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          資料衝突：操作未執行
        </div>
        <div style={{ marginBottom: 8 }}>
          {conflict.reason}
          <span style={{ color: '#9a3412', marginLeft: 6, fontSize: 11 }}>
            （目前版本：{timeStr}）
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onReload}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #c2410c',
              background: '#c2410c',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重新載入
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #fdba74',
                background: '#fff',
                color: '#9a3412',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              關閉
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
