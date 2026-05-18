'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listSessions, listVenues, getCurrentVisibleVenueIds, getCurrentEffectiveRole } from '@/data/api'
import { useStoreSync } from '@/data/store'

const SESSION_TYPE_LABEL: Record<string, string> = {
  male_only:       '男網純男',
  male_mixed:      '男網混排',
  male_position:   '男網專位',
  female_only:     '女網純女',
  female_mixed:    '女網混排',
  female_position: '女網專位',
  rental:          '包場',
}
const SESSION_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  male_only:       { bg: '#dbeafe', text: '#1e40af' },
  male_mixed:      { bg: '#ede9fe', text: '#5b21b6' },
  male_position:   { bg: '#e0f2fe', text: '#0369a1' },
  female_only:     { bg: '#fce7f3', text: '#9d174d' },
  female_mixed:    { bg: '#fdf2f8', text: '#a21caf' },
  female_position: { bg: '#fdf4ff', text: '#7e22ce' },
  rental:          { bg: '#f0fdf4', text: '#166534' },
}
const NET_HEIGHT_LABEL: Record<string, string> = {
  female: '女網', male: '男網', adjustable: '可調',
}
const STATUS_LABEL: Record<string, string> = {
  open: '報名中', full: '已額滿', cancelled: '已取消', completed: '已結束',
}
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  open:      { bg: '#dcfce7', text: '#166534' },
  full:      { bg: '#fef3c7', text: '#92400e' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
  completed: { bg: '#f3f4f6', text: '#6b7280' },
}

export default function SessionsPage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // 使用者選擇的 dropdown 篩選條件（'all' 表示不篩選）
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const role = useMemo(() => mounted ? getCurrentEffectiveRole() : 'owner', [mounted, storeVersion])
  const canCreate = role === 'owner' || role === 'manager'

  // 球館 dropdown 選項 — 依角色可見範圍裁切
  const venuesForDropdown = useMemo(() => {
    const all = listVenues()
    if (visible === 'all') return all
    return all.filter(v => visible.includes(v.id))
  }, [visible])

  // 角色可見範圍變動時，若目前選的 venue 不在可見範圍 → reset 回 all
  useEffect(() => {
    if (visible !== 'all' && selectedVenueId !== 'all' && !visible.includes(selectedVenueId)) {
      setSelectedVenueId('all')
    }
  }, [visible, selectedVenueId])

  const today = new Date().toISOString().split('T')[0]
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const sessions = useMemo(() => {
    const raw = listSessions({ dateFrom: today, dateTo: inTwoWeeks })
      .filter(s => s.status !== 'cancelled')
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.startTime.localeCompare(b.startTime))

    // (1) 先套角色可見範圍
    let result = visible === 'all' ? raw : raw.filter(s => visible.includes(s.venueId))
    // (2) 再套使用者選的球館
    if (selectedVenueId !== 'all') {
      result = result.filter(s => s.venueId === selectedVenueId)
    }
    // (3) 最後套使用者選的場次類型
    if (selectedType !== 'all') {
      result = result.filter(s => s.sessionType === selectedType)
    }
    return result
  }, [today, inTwoWeeks, visible, selectedVenueId, selectedType])

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>場次管理</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>今日所有球館場次</p>
        </div>
        {canCreate ? (
          <Link href="/sessions/new" style={{
            padding: '10px 18px', borderRadius: 8, background: '#1a1917', color: '#fff',
            textDecoration: 'none', fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            + 新增場次
          </Link>
        ) : (
          <button disabled title="新增場次需館長以上權限" style={{
            padding: '10px 18px', borderRadius: 8, background: '#e8e6e0', color: '#aaa',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: 'not-allowed',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            + 新增場次
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={selectedVenueId}
          onChange={e => setSelectedVenueId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}
        >
          <option value="all">所有球館</option>
          {venuesForDropdown.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}
        >
          <option value="all">所有類型</option>
          {Object.entries(SESSION_TYPE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {sessions.map(session => (
          <a key={session.id} href={`/sessions/${session.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
              padding: '16px 20px', display: 'flex', alignItems: 'center',
              gap: 16, cursor: 'pointer', flexWrap: 'wrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#aaa')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e6e0')}
            >
              <div style={{ textAlign: 'center', minWidth: 52 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{session.startTime}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{session.endTime}</div>
              </div>

              <div style={{ width: 1, height: 36, background: '#f0ede6' }} />

              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{session.venueName}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 8,
                    background: SESSION_TYPE_COLOR[session.sessionType].bg,
                    color: SESSION_TYPE_COLOR[session.sessionType].text,
                  }}>
                    {SESSION_TYPE_LABEL[session.sessionType]}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#f5f4f0', color: '#666' }}>
                    {NET_HEIGHT_LABEL[session.netHeight]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {session.court ?? '主場地'} · 上限 {session.maxCapacity} 人
                </div>
              </div>

              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {session.currentCount}
                  <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400 }}>/{session.maxCapacity}</span>
                </div>
                <div style={{ marginTop: 4, background: '#f0ede6', borderRadius: 4, height: 4, width: 80 }}>
                  <div style={{
                    height: 4, borderRadius: 4,
                    width: `${((session.currentCount ?? 0) / session.maxCapacity) * 100}%`,
                    background: (session.currentCount ?? 0) >= session.maxCapacity ? '#e85d3a' : '#10b981',
                  }} />
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 60 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  ${session.courtFee}
                  {session.acEnabled && session.acFee > 0 && (
                    <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 4 }}>+${session.acFee}冷</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#aaa' }}>/ 人</div>
              </div>

              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 8, fontWeight: 500,
                background: STATUS_COLOR[session.status].bg,
                color: STATUS_COLOR[session.status].text,
              }}>
                {STATUS_LABEL[session.status]}
              </span>

              <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
