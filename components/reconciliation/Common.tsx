'use client'

import Link from 'next/link'
import type { AnomalySeverity } from '@/data/api'

// ── 常數 ────────────────────────────────────────────────────

export const VENUE_COLOR: Record<string, string> = {
  v1: '#7c6af7',  // 球魔方 2.0
  v2: '#0ea5e9',  // Ace 2.0
  v3: '#f59e0b',  // 飛翼
  v4: '#10b981',  // Hibi 日日
  v5: '#f43f5e',  // play one
  v6: '#06b6d4',  // 就醬瘋
  v7: '#8b5cf6',  // Ace 3.0
}

export const SEVERITY_COLOR: Record<AnomalySeverity, { bg: string; fg: string; border: string }> = {
  high:   { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5' },
  medium: { bg: '#fff3cd', fg: '#856404', border: '#fde68a' },
  low:    { bg: '#f3f4f6', fg: '#6b7280', border: '#e5e7eb' },
}


// ── 頁面標頭（含返回按鈕） ─────────────────────────────────

export function ReconHeader({
  title, subtitle, backTo, backLabel = '← 對帳系統', actions,
}: {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  actions?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div>
        {backTo && (
          <Link href={backTo} style={{ fontSize: 12, color: '#666', textDecoration: 'none', marginBottom: 4, display: 'inline-block' }}>
            {backLabel}
          </Link>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 0' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}


// ── KPI 卡片 ────────────────────────────────────────────────

export function StatCard({
  label, value, sub, accent, intent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  /** 影響數字顏色（例：缺口用紅） */
  intent?: 'default' | 'warning' | 'danger'
}) {
  const valueColor = intent === 'danger' ? '#e85d3a' : intent === 'warning' ? '#b08000' : '#1a1917'
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      border: '1px solid #e8e6e0', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1, color: valueColor }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{sub}</div>}
      {accent && (
        <div style={{ position: 'absolute', top: 14, right: 14, width: 4, height: 32, borderRadius: 2, background: accent }} />
      )}
    </div>
  )
}


// ── 通用 Panel ─────────────────────────────────────────────

export function Panel({
  title, children, action,
}: {
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
      overflow: 'hidden', marginBottom: 12,
    }}>
      {title && (
        <div style={{
          padding: '13px 16px', borderBottom: '1px solid #f0ede6',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: '4px 16px 12px' }}>{children}</div>
    </div>
  )
}


// ── 嚴重度 Badge ───────────────────────────────────────────

export function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const c = SEVERITY_COLOR[severity]
  const label = severity === 'high' ? '嚴重' : severity === 'medium' ? '中度' : '輕微'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.fg,
      padding: '3px 9px', borderRadius: 999,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}


// ── 一般 Badge（用於狀態） ─────────────────────────────────

export function Badge({
  children, color = 'gray',
}: {
  children: React.ReactNode
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    green:  { bg: '#d1fae5', fg: '#065f46' },
    red:    { bg: '#fee2e2', fg: '#991b1b' },
    yellow: { bg: '#fef3c7', fg: '#92400e' },
    blue:   { bg: '#dbeafe', fg: '#1e40af' },
    purple: { bg: '#ede9fe', fg: '#5b21b6' },
    gray:   { bg: '#f3f4f6', fg: '#4b5563' },
  }
  const c = palette[color]
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.fg,
      padding: '3px 9px', borderRadius: 999,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}


// ── 進度條（季租單繳款比例 / 月結進度等） ──────────────────

export function ProgressBar({
  ratio, accent = '#d4a843', height = 6,
}: {
  ratio: number  // 0~1
  accent?: string
  height?: number
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div style={{
      width: '100%', height, background: '#f0ede6', borderRadius: 999, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: accent, transition: 'width .3s',
      }} />
    </div>
  )
}


// ── Filter 按鈕組 ──────────────────────────────────────────

export function FilterButtons<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#f5f4f0', borderRadius: 10, padding: 4 }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 500,
          background: value === opt.value ? '#fff' : 'transparent',
          color:      value === opt.value ? '#1a1917' : '#888',
          boxShadow:  value === opt.value ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
        }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}


// ── 千分位金額（紅字 = 缺口） ──────────────────────────────

export function Money({
  value, danger = false, muted = false, prefix = '$',
}: {
  value: number
  danger?: boolean
  muted?: boolean
  prefix?: string
}) {
  const color = danger && value > 0 ? '#e85d3a' : muted ? '#888' : '#1a1917'
  const sign = value < 0 ? '-' : ''
  return (
    <span style={{ color, fontWeight: danger && value > 0 ? 600 : 500 }}>
      {sign}{prefix}{Math.abs(value).toLocaleString()}
    </span>
  )
}
