'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listAuditLogs,
  listVenues,
} from '@/data/api'
import { hydrateStore, useStoreSync, resetStore } from '@/data/store'
import type { AuditAction, AuditLog } from '@/types'

// ── Action → 顯示對應表 ──────────────────────────────────────

interface ActionStyle { label: string; color: string; bg: string }

const ACTION_STYLE: Record<AuditAction, ActionStyle> = {
  // 既有 ──────────────────────────────
  CREATE_REGISTRATION:        { label: '新增報名',      color: '#166534', bg: '#dcfce7' },
  CANCEL_REGISTRATION:        { label: '取消報名',      color: '#6b7280', bg: '#f3f4f6' },
  UPDATE_PAYMENT:             { label: '付款更新',      color: '#1e40af', bg: '#dbeafe' },
  ADD_PAYMENT:                { label: '新增付款',      color: '#166534', bg: '#dcfce7' },
  ADD_PRODUCT_SALE:           { label: '商品販售',      color: '#166534', bg: '#dcfce7' },
  ADD_PRODUCT_GIFT:           { label: '商品贈送',      color: '#9d174d', bg: '#fce7f3' },
  ADJUST_STOCK:               { label: '庫存調整',      color: '#1e40af', bg: '#dbeafe' },
  UPDATE_SESSION:             { label: '場次調整',      color: '#92400e', bg: '#fef3c7' },
  CANCEL_SESSION:             { label: '取消場次',      color: '#991b1b', bg: '#fee2e2' },
  // 階段 1.1 主揪相關 ─────────────────
  CAPTAIN_LOGIN:              { label: '主揪登入',      color: '#6b7280', bg: '#f3f4f6' },
  MARK_ATTENDANCE_BY_CAPTAIN: { label: '主揪簽到',      color: '#166534', bg: '#dcfce7' },
  ADD_WALKIN_BY_CAPTAIN:      { label: '主揪加臨打',    color: '#a16207', bg: '#fef9c3' },
  // 階段 1.1 自助回報 ─────────────────
  SELF_PAYMENT_REPORT:        { label: '自助回報付款',  color: '#0e7490', bg: '#cffafe' },
  // 階段 1.1 季租單 ──────────────────
  CREATE_SEASON_RENTAL:       { label: '新增季租單',    color: '#1e40af', bg: '#dbeafe' },
  UPDATE_SEASON_RENTAL:       { label: '修改季租單',    color: '#92400e', bg: '#fef3c7' },
  CANCEL_SEASON_RENTAL:       { label: '停用季租單',    color: '#991b1b', bg: '#fee2e2' },
  // 階段 3 production 新增 ────────────
  UNCANCEL_REGISTRATION:      { label: '取消請假',      color: '#166534', bg: '#dcfce7' },
  COPY_CAPTAIN_TOKEN:         { label: '複製連結',      color: '#6b7280', bg: '#f3f4f6' },
}

const DEFAULT_STYLE: ActionStyle = { label: '其他', color: '#6b7280', bg: '#f3f4f6' }


// ── 時間格式 ────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  if (isToday) return `${hh}:${mm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}


// ── Filter modes ─────────────────────────────────────────────

type CategoryFilter = 'all' | 'captain' | 'admin'


export default function AuditPage() {
  // 訂閱 store + 自行 hydrate（萬一 Sidebar 還沒 mount）
  useStoreSync()
  useEffect(() => { hydrateStore() }, [])

  const [category, setCategory] = useState<CategoryFilter>('all')
  const [venue,    setVenue]    = useState<string>('all')

  const venues = useMemo(() => listVenues().filter(v => v.isActive), [])
  const logs = useMemo<AuditLog[]>(
    () => listAuditLogs({ category, venue }),
    [category, venue],
  )

  // 商品贈送異常檢測（從原 MOCK_LOGS 沿用 — 改成讀真 logs）
  const giftCount = useMemo(
    () => listAuditLogs().filter(l => l.action === 'ADD_PRODUCT_GIFT').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs],
  )

  // Counts for filter buttons
  const allCount     = useMemo(() => listAuditLogs().length, [logs])
  const captainCount = useMemo(() => listAuditLogs({ category: 'captain' }).length, [logs])
  const adminCount   = useMemo(() => listAuditLogs({ category: 'admin' }).length, [logs])

  const handleReset = () => {
    if (!confirm(
      '⚠️ 重置 demo 資料？\n\n' +
      '會清空 localStorage 中所有 mutation（請假、加臨打、token regen、新增季租單、audit logs），\n' +
      '頁面會 reload，所有資料回到 generator 種子狀態。',
    )) return
    resetStore()
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.audit-wrap{padding-top:64px !important}}`}</style>
      <div className="audit-wrap" style={{ paddingTop: 0 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>操作紀錄</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
              所有人員 + 主揪操作的完整稽核軌跡（即時更新、跨頁同步）
            </p>
          </div>
          <button onClick={handleReset} style={{
            padding: '6px 12px', fontSize: 12, color: '#888',
            background: 'none', border: '1px solid #e0ddd5', borderRadius: 6, cursor: 'pointer',
          }}>
            🔄 重置 demo
          </button>
        </div>

        {giftCount >= 3 && (
          <div style={{ background: '#fce7f3', border: '1px solid #f0abcd', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ fontSize: 13, color: '#9d174d' }}>
              <strong>商品贈送次數偏高（{giftCount} 次）</strong>，建議館主確認是否有異常操作。
            </div>
          </div>
        )}

        {/* Filter 列 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={venue} onChange={e => setVenue(e.target.value)} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0',
            background: '#fff', fontSize: 13, color: '#1a1917',
          }}>
            <option value="all">所有球館</option>
            {venues.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
          {[
            { key: 'all'     as CategoryFilter, label: `全部 (${allCount})` },
            { key: 'captain' as CategoryFilter, label: `🎯 主揪動作 (${captainCount})` },
            { key: 'admin'   as CategoryFilter, label: `👨‍💼 館長動作 (${adminCount})` },
          ].map(f => (
            <button key={f.key} onClick={() => setCategory(f.key)} style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: category === f.key ? '#1a1917' : '#fff',
              color: category === f.key ? '#fff' : '#555',
              borderColor: category === f.key ? '#1a1917' : '#e8e6e0',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Log list */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px 110px 80px 110px 1fr 220px',
            padding: '10px 20px', background: '#fafaf8',
            fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12,
          }}>
            <div>時間</div>
            <div>操作人員</div>
            <div>球館</div>
            <div>類型</div>
            <div>對象</div>
            <div>詳細</div>
          </div>
          {logs.map(log => {
            const style = ACTION_STYLE[log.action] ?? DEFAULT_STYLE
            const actor = log.actorName ?? log.userName ?? '—'
            const actorIsCaptain = log.actorType === 'captain'
            return (
              <div key={log.id} style={{
                display: 'grid',
                gridTemplateColumns: '70px 110px 80px 110px 1fr 220px',
                padding: '13px 20px', borderTop: '1px solid #f5f4f0',
                alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{formatTime(log.createdAt)}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {actor}
                  {actorIsCaptain && (
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 3,
                      background: '#fef3c7', color: '#92400e', marginLeft: 5,
                    }}>主揪</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>{log.venue ?? '—'}</div>
                <div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: style.bg, color: style.color, fontWeight: 500,
                  }}>
                    {style.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.targetLabel ?? log.entityType ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.detail ?? '—'}
                </div>
              </div>
            )
          })}
          {logs.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 500, color: '#666', marginBottom: 4 }}>
                {category === 'all' ? '尚無操作紀錄' : '此分類下沒有操作紀錄'}
              </div>
              <div style={{ fontSize: 12, color: '#aaa' }}>
                試試到主揪頁標記請假、或館長端新增季租單，操作會即時出現在這
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
