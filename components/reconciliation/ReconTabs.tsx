'use client'

// ============================================================
// components/reconciliation/ReconTabs.tsx — 階段 21 M2（對帳簡化）
// ============================================================
// 把多個性質相近的對帳子頁「合併成一頁、用頁籤切換」。
// 設計原則：
//   - 不改任何子頁邏輯，子頁元件原樣 import 進來，只在 active 時才掛載
//     （`render()` 只在被選中時呼叫 → 只跑 active 子頁的 data hooks）。
//   - 容器只提供「群組標題 + 頁籤列」；子頁自己的 ReconHeader（含「← 對帳系統」
//     回首頁連結 + 子頁標題）原樣保留，當作該頁籤的區塊標題，避免重複 header。
//   - 手機：容器頁籤列補 64px 上緣避開固定 topbar，並把子頁 .recon-wrap 的
//     行動上緣歸零（否則會疊加兩次 64px）。此 <style> 只在本容器路由掛載時生效。
// ============================================================

import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export interface ReconTab {
  key: string
  label: string
  icon: string
  render: () => ReactNode
}

export function ReconTabs({
  groupTitle,
  tabs,
}: {
  groupTitle: string
  tabs: ReconTab[]
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const activeTab = tabs.find(t => t.key === active) ?? tabs[0]

  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .recon-tabwrap { padding-top: 64px !important; }
          .recon-wrap    { padding-top: 0 !important; }
        }
      `}</style>

      {/* —— 群組標題 + 頁籤列 —— */}
      <div className="recon-tabwrap" style={{ padding: '18px 24px 0' }}>
        <Link
          href="/reconciliation"
          style={{ fontSize: 12, color: '#888', textDecoration: 'none', display: 'inline-block', marginBottom: 6 }}>
          ← 對帳系統
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1917', marginBottom: 12 }}>
          {groupTitle}
        </div>

        <div style={{
          display: 'flex', gap: 2, flexWrap: 'wrap',
          borderBottom: '1px solid #e8e6e0',
        }}>
          {tabs.map(t => {
            const on = t.key === activeTab?.key
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 15px', border: 'none', cursor: 'pointer',
                  background: 'transparent',
                  fontSize: 13, fontWeight: on ? 700 : 500,
                  color: on ? '#1a1917' : '#999',
                  borderBottom: on ? '2px solid #d4a843' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color .12s ease',
                  borderTopLeftRadius: 8, borderTopRightRadius: 8,
                }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* —— active 子頁（內含其自身 ReconHeader 當區塊標題）—— */}
      <div>{activeTab?.render()}</div>
    </div>
  )
}
