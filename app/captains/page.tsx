'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  listSeasonRentalsForAdmin,
  listVenues,
  listCustomers,
  listSeasons,
  listTimeslots,
  adminLogCopyToken,
  adminRegenerateToken,
  adminDeactivateRental,
  adminCreateRental,
  buildCaptainUrl,
  getCurrentVisibleVenueIds,
  type AdminSeasonRentalRow,
} from '@/data/api'
import { useStoreSync } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, Badge, Money, ProgressBar, FilterButtons, VENUE_COLOR,
} from '@/components/reconciliation/Common'
import type { SeasonRentalStatus, Timeslot, Customer, Season } from '@/types'

const STATUS_LABEL: Record<SeasonRentalStatus, string> = {
  pending:   '待繳款',
  active:    '進行中',
  completed: '已結束',
  cancelled: '已取消',
}

const STATUS_COLOR: Record<SeasonRentalStatus, 'green' | 'red' | 'yellow' | 'gray'> = {
  pending:   'red',
  active:    'green',
  completed: 'gray',
  cancelled: 'gray',
}

type FilterMode = 'all' | 'critical' | 'expired'


export default function CaptainAdminPage() {
  const [venueId, setVenueId] = useState<string>('all')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // 訂閱 store — mutation / 切視角 都會 trigger re-render
  const storeVersion = useStoreSync()

  // SSR-safe mount flag — 沒 mount 前用 'all' 視角 fallback
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // 視角：owner='all'，manager 限自己館
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  const allVenues = listVenues().filter(v => v.isActive)
  const venues = visible === 'all'
    ? allVenues
    : allVenues.filter(v => visible.includes(v.id))

  // 切到 manager 視角時，若 venueId 不在可見集合，重置成 'all'
  useEffect(() => {
    if (visible !== 'all' && venueId !== 'all' && !visible.includes(venueId)) {
      setVenueId('all')
    }
  }, [visible, venueId])

  // 全部 rows → 先按視角過濾 → 變成「視角內所有」
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allRows = useMemo<AdminSeasonRentalRow[]>(() => {
    const full = listSeasonRentalsForAdmin()
    if (visible === 'all') return full
    const venueNameSet = new Set(venues.map(v => v.name))
    return full.filter(r => r.rental.venueName && venueNameSet.has(r.rental.venueName))
  // visible 依賴 storeVersion 已 mark
  }, [storeVersion, visible])

  // 過濾：先按球館 → 再按 mode
  const rows = useMemo(() => {
    let r = allRows
    if (venueId !== 'all') {
      const venueName = allVenues.find(v => v.id === venueId)?.name
      r = r.filter(row => row.rental.venueName === venueName)
    }
    if (filter === 'critical') r = r.filter(row => row.isCritical)
    if (filter === 'expired')  r = r.filter(row => row.tokenExpired)
    return r
  }, [allRows, venueId, filter, allVenues])

  const totals = useMemo(() => ({
    total:        allRows.length,
    critical:     allRows.filter(r => r.isCritical).length,
    expired:      allRows.filter(r => r.tokenExpired).length,
    totalGap:     allRows.reduce((s, r) => s + Math.max(0, r.gap), 0),
  }), [allRows])

  const handleNewRental = () => {
    setShowCreateModal(true)
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .ca-wrap   { padding-top: 64px !important; }
          .ca-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .ca-cards  { grid-template-columns: 1fr !important; }
          .ca-actions { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      <div className="ca-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="🎯 主揪管理"
          subtitle="管理全部季租單，發送/重發主揪 token、追蹤繳款狀態"
          actions={
            <button
              onClick={handleNewRental}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#1a1917', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}>
              + 新增季租單
            </button>
          }
        />

        {/* KPI */}
        <div className="ca-stats" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10, marginBottom: 16,
        }}>
          <StatCard label="季租單總數" value={`${totals.total}`} sub="本季 active + pending" />
          <StatCard
            label="待繳款"
            value={`${totals.critical}`}
            sub="主揪欠款中"
            intent={totals.critical > 0 ? 'danger' : 'default'}
            accent={totals.critical > 0 ? '#dc2626' : undefined}
          />
          <StatCard
            label="待收金額"
            value={`$${totals.totalGap.toLocaleString()}`}
            sub="未繳清總額"
            intent={totals.totalGap > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="Token 過期"
            value={`${totals.expired}`}
            sub="需重發新連結"
            intent={totals.expired > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Filter 列 */}
        <div className="ca-actions" style={{
          display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <FilterButtons<FilterMode>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all',      label: `全部 (${allRows.length})` },
              { value: 'critical', label: `🔴 待繳款 (${totals.critical})` },
              { value: 'expired',  label: `⏰ 已過期 (${totals.expired})` },
            ]}
          />
          <select
            value={venueId}
            onChange={e => setVenueId(e.target.value)}
            style={{
              padding: '7px 12px', fontSize: 13, fontWeight: 500,
              borderRadius: 8, border: '1px solid #e0ddd5', background: '#fff',
              cursor: 'pointer', color: '#1a1917',
            }}>
            <option value="all">全部球館</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {/* 季租單卡片網格 */}
        {rows.length === 0 ? (
          <Panel>
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
              {filter === 'all' ? '尚無季租單' : '此篩選條件下沒有季租單 🎉'}
            </div>
          </Panel>
        ) : (
          <div className="ca-cards" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 12,
          }}>
            {rows.map(row => (
              <RentalManageCard key={row.rental.id} row={row} />
            ))}
          </div>
        )}

        {/* 提示區 */}
        <div style={{
          marginTop: 24, padding: '14px 16px',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, fontSize: 12, color: '#854d0e', lineHeight: 1.6,
        }}>
          💡 <strong>主揪 token 機制：</strong>
          每張季租單都有獨立的長隨機 token，主揪用此 token 打開
          <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 11, margin: '0 3px' }}>
            /captain/[token]
          </code>
          即可查看自己的場次與繳款狀態，不需密碼帳號。
          每季結束 token 自動失效，新季由館長重發。
        </div>
      </div>

      {showCreateModal && (
        <RentalCreateModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}


// ── 單張季租單管理卡 ───────────────────────────────────────

function RentalManageCard({ row }: { key?: string | number; row: AdminSeasonRentalRow }) {
  const { rental, tokenExpired, paidRatio, gap, isCritical, totalSessions, pastSessions, remainingSessions, captainUrl } = row

  const venueId = useMemo(() => {
    // 從 venueName 反查 venueId（用於配色）
    const venue = listVenues().find(v => v.name === rental.venueName)
    return venue?.id ?? 'v1'
  }, [rental.venueName])

  const accent = VENUE_COLOR[venueId] ?? '#7c6af7'

  const fullUrl = `https://volleyball-erp.vercel.app${captainUrl}`

  const handleCopy = () => {
    const finish = () => adminLogCopyToken(rental.id)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl)
        .then(() => { finish(); alert(`📋 已複製主揪連結\n\n${fullUrl}\n\n您可以將此連結傳給 ${rental.captainName}（LINE / 簡訊都行）`) })
        .catch(() => { finish(); alert(`連結內容：\n${fullUrl}\n\n（請手動複製）`) })
    } else {
      finish()
      alert(`連結內容：\n${fullUrl}\n\n（請手動複製）`)
    }
  }

  const handleRegenerate = () => {
    if (!confirm(
      `確定要重發 ${rental.captainName} 的 token？\n\n` +
      `舊連結會立即失效，主揪需用新連結才能登入。`
    )) return
    const r = adminRegenerateToken(rental.id)
    if (!r.ok) {
      alert(`⚠️ ${r.reason}`)
      return
    }
    const newUrl = `https://volleyball-erp.vercel.app${buildCaptainUrl(r.newToken)}`
    // 試著直接複製新連結
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(newUrl).catch(() => {})
    }
    alert(
      `✅ 已重發 ${rental.captainName} 的 token\n\n` +
      `新連結（已複製到剪貼簿）：\n${newUrl}\n\n` +
      `舊連結立即失效。請傳新連結給主揪。`
    )
  }

  const handleDeactivate = () => {
    if (!confirm(
      `確定要停用 ${rental.captainName} 的季租單？\n\n` +
      `此季租單會標記為 cancelled，token 立即失效。\n` +
      `主揪剩餘場次的季打人員資格將被取消。`
    )) return
    const r = adminDeactivateRental(rental.id)
    if (!r.ok) {
      alert(`⚠️ ${r.reason}`)
      return
    }
    alert(`✅ 已停用 ${rental.captainName} 的季租單`)
  }

  const handleOpenAsCaptain = () => {
    if (typeof window !== 'undefined') {
      window.open(captainUrl, '_blank', 'noopener')
    }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
      borderLeft: `4px solid ${isCritical ? '#dc2626' : accent}`,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{rental.captainName}</span>
              <Badge color={STATUS_COLOR[rental.status]}>{STATUS_LABEL[rental.status]}</Badge>
              {tokenExpired && <Badge color="yellow">⏰ 過期</Badge>}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              {rental.venueName}・{rental.timeslotLabel}
            </div>
            {rental.captainPhone && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                📱 {rental.captainPhone}
              </div>
            )}
          </div>
        </div>

        {/* 繳款進度 */}
        <div style={{ marginTop: 6, marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>繳款進度</span>
            <span style={{ fontSize: 11, color: '#888' }}>
              <Money value={rental.paidAmount} muted prefix="$" />
              {' / '}
              <Money value={rental.totalAmount} prefix="$" />
            </span>
          </div>
          <ProgressBar
            ratio={paidRatio}
            accent={isCritical ? '#dc2626' : '#15803d'}
          />
          <div style={{ fontSize: 11, marginTop: 4 }}>
            {isCritical ? (
              <span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>尚欠 <Money value={gap} prefix="$" /></span>
                <span style={{ color: '#888' }}>（{(paidRatio * 100).toFixed(0)}%）</span>
              </span>
            ) : (
              <span style={{ color: '#15803d', fontWeight: 600 }}>✓ 已繳清</span>
            )}
          </div>
        </div>

        {/* 場次計數 */}
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: '#fafaf7', borderRadius: 6,
          fontSize: 11, color: '#666',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>📅 場次 {pastSessions} / {totalSessions}</span>
          <span>{remainingSessions > 0 ? `剩 ${remainingSessions} 場` : '已完季'}</span>
        </div>
      </div>

      {/* Token 區 */}
      <div style={{
        padding: '10px 16px',
        background: '#fafaf7',
        borderTop: '1px solid #f0ede6',
        fontSize: 11, color: '#666',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>主揪連結 token</span>
          {tokenExpired && <span style={{ color: '#854d0e' }}>· 已過期</span>}
        </div>
        <code style={{
          fontSize: 10, color: '#888',
          background: '#fff', padding: '4px 8px', borderRadius: 4,
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {rental.accessToken}
        </code>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
          失效時間：{rental.accessTokenExpiresAt.split('T')[0]}
        </div>
      </div>

      {/* 行動列 */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #f0ede6',
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        <ActionBtn onClick={handleCopy} primary>
          📋 複製連結
        </ActionBtn>
        <ActionBtn onClick={handleOpenAsCaptain}>
          👁 預覽主揪頁
        </ActionBtn>
        <ActionBtn onClick={handleRegenerate}>
          🔄 重發 token
        </ActionBtn>
        {rental.status !== 'cancelled' && rental.status !== 'completed' && (
          <ActionBtn onClick={handleDeactivate} danger>
            停用
          </ActionBtn>
        )}
      </div>
    </div>
  )
}


function ActionBtn({
  children, onClick, primary, danger,
}: {
  key?: string | number
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
}) {
  const styles = primary
    ? { bg: '#1a1917', fg: '#fff', border: '#1a1917' }
    : danger
    ? { bg: '#fff', fg: '#991b1b', border: '#fca5a5' }
    : { bg: '#fff', fg: '#1a1917', border: '#e0ddd5' }
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 11px', fontSize: 12, fontWeight: 500,
        background: styles.bg, color: styles.fg,
        border: `1px solid ${styles.border}`, borderRadius: 6,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  )
}


// ── 新增季租單 Modal（階段 3 production 升級）─────────────────

const WEEKDAY_LABEL = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

function RentalCreateModal({ onClose }: { onClose: () => void }) {
  // 切視角時 modal 內的 venues 也要限縮（manager 不能幫別館開新季租單）
  const visible = getCurrentVisibleVenueIds()
  const venues   = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    if (visible === 'all') return all
    return all.filter(v => visible.includes(v.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const seasons  = useMemo(() => listSeasons(), [])
  const customers = useMemo<Customer[]>(
    () => listCustomers().filter(c => !c.isBanned).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
    [],
  )
  const allTimeslots = useMemo<Timeslot[]>(() => listTimeslots(), [])

  // 預設選第一個 active 季（通常是當前季）
  const defaultSeason = useMemo<Season | undefined>(() => {
    const today = new Date().toISOString().split('T')[0]
    return seasons.find(s => s.startDate <= today && s.endDate >= today)
        ?? seasons[seasons.length - 1]
  }, [seasons])

  const [seasonId, setSeasonId] = useState(defaultSeason?.id ?? '')
  const [venueIdSel, setVenueIdSel] = useState<string>(venues[0]?.id ?? '')
  const [timeslotId, setTimeslotId] = useState<string>('')
  const [captainCustomerId, setCaptainCustomerId] = useState<string>('')
  const [pricePerSession, setPricePerSession] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successUrl, setSuccessUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 該球館的時段
  const venueTimeslots = useMemo(
    () => allTimeslots.filter(t => t.venueId === venueIdSel).sort((a, b) =>
      a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
    ),
    [allTimeslots, venueIdSel],
  )

  // 選 timeslot 時自動帶入建議 price（球費 × 18 人，是 SeasonRental.pricePerSession 的常見值）
  const handleTimeslotChange = (id: string) => {
    setTimeslotId(id)
    const t = venueTimeslots.find(x => x.id === id)
    if (t) setPricePerSession(t.defaultCourtFee * (t.defaultMaxCapacity ?? 18))
  }

  const selectedSeason = seasons.find(s => s.id === seasonId)
  const numWeeks = selectedSeason?.numWeeks ?? 12
  const totalAmount = pricePerSession * numWeeks
  const canSubmit = seasonId && timeslotId && captainCustomerId && pricePerSession > 0 && !submitting

  const handleSubmit = () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMsg(null)
    const r = adminCreateRental({
      timeslotId, seasonId, captainCustomerId, pricePerSession,
      notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (!r.ok) {
      setErrorMsg(r.reason)
      return
    }
    const newUrl = `https://volleyball-erp.vercel.app${buildCaptainUrl(r.token)}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(newUrl).catch(() => {})
    }
    setSuccessUrl(newUrl)
  }

  // 成功畫面
  if (successUrl) {
    return (
      <ModalShell onClose={onClose}>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>季租單已建立</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>
            新主揪連結已複製到剪貼簿。請傳給主揪：
          </p>
          <div style={{
            background: '#f5f4f0', border: '1px solid #e0ddd5', borderRadius: 8,
            padding: '10px 12px', fontSize: 12, fontFamily: 'monospace',
            wordBreak: 'break-all', marginBottom: 16, color: '#1a1917',
          }}>
            {successUrl}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={primaryBtn}>完成</button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding: '20px 22px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>✏️ 新增季租單</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* 1. 球館 + 時段 */}
        <FormRow label="球館">
          <select value={venueIdSel} onChange={e => { setVenueIdSel(e.target.value); setTimeslotId('') }} style={selectStyle}>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </FormRow>

        <FormRow label="時段">
          <select value={timeslotId} onChange={e => handleTimeslotChange(e.target.value)} style={selectStyle}>
            <option value="">— 請選時段 —</option>
            {venueTimeslots.map(t => (
              <option key={t.id} value={t.id}>
                {WEEKDAY_LABEL[t.dayOfWeek]} {t.startTime}-{t.endTime}
                {t.label ? ` · ${t.label}` : ''}
                {t.court ? ` · ${t.court}` : ''}
                {' · '}球費 ${t.defaultCourtFee}
              </option>
            ))}
          </select>
          {venueTimeslots.length === 0 && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>此球館無時段（請先在球館設定建立）</div>
          )}
        </FormRow>

        {/* 2. 季 */}
        <FormRow label="季">
          <select value={seasonId} onChange={e => setSeasonId(e.target.value)} style={selectStyle}>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.startDate} ~ {s.endDate} · {s.numWeeks} 週
              </option>
            ))}
          </select>
        </FormRow>

        {/* 3. 主揪（從客戶清單）*/}
        <FormRow label={`主揪（${customers.length} 位可選）`}>
          <select value={captainCustomerId} onChange={e => setCaptainCustomerId(e.target.value)} style={selectStyle}>
            <option value="">— 請選客戶 —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` · ${c.phone}` : ''}{c.skillLevel ? ` · ${c.skillLevel}級` : ''}
              </option>
            ))}
          </select>
        </FormRow>

        {/* 4. 每場應收金額 */}
        <FormRow label="每場應收金額（元）">
          <input
            type="number" min={0} step={50}
            value={pricePerSession || ''}
            onChange={e => setPricePerSession(Number(e.target.value) || 0)}
            placeholder="例：5400（球費 × 18 人）"
            style={{ ...selectStyle, fontFamily: 'monospace' }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            選時段後會自動帶入建議值（球費 × 容量）；可手動調整。
          </div>
        </FormRow>

        {/* 5. 試算 */}
        <div style={{
          background: '#f5f4f0', border: '1px solid #e0ddd5', borderRadius: 8,
          padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#1a1917',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#666' }}>每場應收</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>${pricePerSession.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#666' }}>× 預期場次數</span>
            <span style={{ fontFamily: 'monospace' }}>{numWeeks} 場</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e0ddd5', paddingTop: 6, marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>季初一次性應收</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>${totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 6. 備註 */}
        <FormRow label="備註（選填）">
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="例：主揪要求保留 X 號的位子給某某"
            rows={2}
            style={{ ...selectStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </FormRow>

        {errorMsg && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: '10px 12px', color: '#991b1b', fontSize: 13, marginBottom: 12,
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={secondaryBtn}>取消</button>
          <button onClick={handleSubmit} disabled={!canSubmit} style={canSubmit ? primaryBtn : disabledBtn}>
            {submitting ? '建立中…' : '建立 + 產生 token'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: '100%',
          maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}>
        {children}
      </div>
    </div>
  )
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  borderRadius: 8, border: '1px solid #e0ddd5', background: '#fff',
  color: '#1a1917', boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, border: 'none',
  background: '#1a1917', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, border: '1px solid #e0ddd5',
  background: '#fff', color: '#444', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}

const disabledBtn: React.CSSProperties = {
  ...primaryBtn, background: '#d0cec8', color: '#888', cursor: 'not-allowed',
}
