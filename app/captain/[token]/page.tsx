'use client'

import { use, useEffect, useState, useMemo } from 'react'
import {
  getCaptainPortalData,
  listCaptainSessions,
  getCaptainSessionDetail,
  listSessionSeasonPlayersWithLeave,
  captainMarkLeave,
  captainUnmarkLeave,
  captainAddWalkIn,
  isConflictResult,
  type CaptainPortalData,
  type CaptainSessionSummary,
  type CaptainSessionDetail,
  type RegistrationWithCustomer,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { SeasonRental, ConflictResult } from '@/types'
import ConflictBanner from '@/components/ConflictBanner'

// ── 顯示用 helper ──────────────────────────────────────────

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function formatDateShort(dateStr: string): string {
  // YYYY-MM-DD → "5/10（日）"
  const [, m, d] = dateStr.split('-').map(Number)
  const date = new Date(dateStr + 'T00:00:00Z')
  const w = date.getUTCDay()
  return `${m}/${d}（${WEEKDAY[w]}）`
}

function formatDateLong(dateStr: string): string {
  // YYYY-MM-DD → "2026 年 5 月 10 日（日）"
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(dateStr + 'T00:00:00Z')
  const w = date.getUTCDay()
  return `${y} 年 ${m} 月 ${d} 日（${WEEKDAY[w]}）`
}

function moneyText(n: number): string {
  return `$${n.toLocaleString()}`
}

const SKILL_LABEL: Record<string, string> = {
  S: 'S 級', A: 'A 級', B: 'B 級', C: 'C 級', D: 'D 級', N: '新手',
}


// ════════════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════════════

export default function CaptainPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  // 訂閱 store + 自行 hydrate（這頁隱藏 sidebar，Sidebar 的 hydrate 不會被觸發）
  useStoreSync()
  useEffect(() => { hydrateStore() }, [])

  const portal = getCaptainPortalData(token)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // 永遠先把對外頁面該蓋掉的 ERP UI 去掉
  const hideErpChrome = (
    <style>{`
      #sidebar, #mobile-topbar, [data-testid="impersonation-banner"] { display: none !important; }
      body { background: #fafaf7 !important; }
    `}</style>
  )

  if (!portal) {
    return (
      <Shell>
        {hideErpChrome}
        <NotFoundScreen />
      </Shell>
    )
  }

  if (portal.tokenStatus === 'expired') {
    return (
      <Shell>
        {hideErpChrome}
        <ExpiredScreen rental={portal.rental} />
      </Shell>
    )
  }

  return (
    <Shell>
      {hideErpChrome}
      {selectedSessionId ? (
        <SessionDetailView
          sessionId={selectedSessionId}
          rentalId={portal.rental.id}
          onBack={() => setSelectedSessionId(null)}
        />
      ) : (
        <OverviewView
          portal={portal}
          onSelectSession={setSelectedSessionId}
        />
      )}
    </Shell>
  )
}


// ── 外殼（mobile-first 容器） ─────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', padding: '16px 14px 80px',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif',
      color: '#1a1917',
    }}>
      {children}
    </div>
  )
}


// ── 錯誤畫面 ───────────────────────────────────────────────

function NotFoundScreen() {
  return (
    <div style={{ paddingTop: 80, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>主揪連結無效</h1>
      <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
        此連結不存在或格式錯誤。<br />
        請向您的球館索取最新的主揪連結。
      </p>
    </div>
  )
}

function ExpiredScreen({ rental }: { rental: SeasonRental }) {
  return (
    <div style={{ paddingTop: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>連結已過期</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.6 }}>
        嗨 {rental.captainName}，<br />
        您的主揪連結已於 {rental.accessTokenExpiresAt.split('T')[0]} 失效。<br />
        請向 {rental.venueName} 索取新季的連結。
      </p>
      <div style={{
        fontSize: 12, color: '#666', background: '#f5f4f0',
        padding: '12px 14px', borderRadius: 8, textAlign: 'left',
      }}>
        💡 <strong>為什麼會過期？</strong><br />
        每季結束後，舊連結會自動失效，避免外流。
        新季開始時，館長會發送新的連結給您。
      </div>
    </div>
  )
}


// ════════════════════════════════════════════════════════════
// Overview View — 主揪入口主畫面
// ════════════════════════════════════════════════════════════

function OverviewView({
  portal,
  onSelectSession,
}: {
  portal: CaptainPortalData
  onSelectSession: (id: string) => void
}) {
  const sessions = useMemo(() => listCaptainSessions(portal.rental.id), [portal.rental.id])

  return (
    <>
      {/* 歡迎區 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>主揪專屬頁</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
          嗨，{portal.rental.captainName}
        </h1>
        <div style={{ fontSize: 13, color: '#666', marginTop: 6, lineHeight: 1.5 }}>
          {portal.rental.venueName}・{portal.rental.timeslotLabel}
          <br />
          <span style={{ color: '#888' }}>{portal.rental.seasonName}</span>
        </div>
      </div>

      {/* 故事點 4 主舞台：欠款紅框 banner */}
      {portal.isPaymentCritical && (
        <PaymentCriticalBanner portal={portal} />
      )}

      {portal.rental.status === 'pending' && (
        <PendingActivationNote />
      )}

      {/* KPI 卡 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8, marginBottom: 16,
      }}>
        <MiniStat label="本季場次" value={`${portal.totalSessions}`} sub={`已過 ${portal.pastSessions} / 剩 ${portal.upcomingSessions}`} />
        <MiniStat
          label="季打人員"
          value={`${portal.seasonPlayerCount}`}
          sub={portal.rental.status === 'pending' ? '待繳款後啟動' : '人 / 18'}
          muted={portal.rental.status === 'pending'}
        />
        <MiniStat
          label="應繳"
          value={moneyText(portal.expectedAmount)}
          sub="季初一次性"
        />
        <MiniStat
          label={portal.isPaymentCritical ? '尚欠' : '已繳清'}
          value={portal.isPaymentCritical ? moneyText(portal.outstandingAmount) : '✓'}
          sub={`${(portal.paidRatio * 100).toFixed(0)}% 已繳`}
          intent={portal.isPaymentCritical ? 'danger' : 'success'}
        />
      </div>

      {/* 下一場提示 */}
      {portal.nextSession && (
        <NextSessionHint sessionDate={portal.nextSession.sessionDate} />
      )}

      {/* 場次列表 */}
      <SectionTitle>📅 我的本季場次</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {sessions.map(s => (
          <SessionCard key={s.session.id} summary={s} onClick={() => onSelectSession(s.session.id)} />
        ))}
      </div>

      <FooterNote token={portal.rental.accessToken} />
    </>
  )
}


// ── 欠款 banner（故事點 4 wow 主舞台）────────────────────

function PaymentCriticalBanner({ portal }: { portal: CaptainPortalData }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      border: '2px solid #f87171',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 14,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#991b1b',
        letterSpacing: '.05em', marginBottom: 6,
      }}>
        ⚠️ 待繳款提醒
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: '#991b1b',
        letterSpacing: '-0.5px', lineHeight: 1.1,
      }}>
        您本季尚欠 {moneyText(portal.outstandingAmount)}
      </div>
      <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 6, lineHeight: 1.5 }}>
        您已繳 {moneyText(portal.paidAmount)} / 應繳 {moneyText(portal.expectedAmount)}（{(portal.paidRatio * 100).toFixed(0)}%）
        <br />
        請盡快聯絡 {portal.rental.venueName} 完成繳費。
      </div>
      <button
        onClick={() => alert(`📞 聯絡 ${portal.rental.venueName}\n\n（demo 模式：實際版會直接撥電話或開 LINE）`)}
        style={{
          marginTop: 10, width: '100%', padding: '11px 14px',
          background: '#991b1b', color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
        聯絡館方繳款
      </button>
    </div>
  )
}


function PendingActivationNote() {
  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: 8, padding: '10px 12px',
      marginBottom: 14, fontSize: 12, color: '#854d0e', lineHeight: 1.5,
    }}>
      💡 <strong>季租單尚未啟動：</strong>
      您繳清後，本時段會正式套用「季打人員每場免費」規則。
      在此之前，每位報到者皆視為臨打。
    </div>
  )
}


function NextSessionHint({ sessionDate }: { sessionDate: string }) {
  const today = new Date().toISOString().split('T')[0]
  const isToday = sessionDate === today
  return (
    <div style={{
      background: isToday ? '#dcfce7' : '#eff6ff',
      border: `1px solid ${isToday ? '#86efac' : '#bfdbfe'}`,
      borderRadius: 8, padding: '10px 12px',
      marginBottom: 16, fontSize: 13, fontWeight: 500,
      color: isToday ? '#14532d' : '#1e40af',
    }}>
      {isToday ? '🏐 今天就是場次日！' : `📅 下一場：${formatDateLong(sessionDate)}`}
    </div>
  )
}


// ── 小元件 ────────────────────────────────────────────────

function MiniStat({
  label, value, sub, intent, muted,
}: {
  label: string
  value: string
  sub?: string
  intent?: 'danger' | 'success'
  muted?: boolean
}) {
  const valueColor = intent === 'danger' ? '#dc2626' : intent === 'success' ? '#15803d' : muted ? '#888' : '#1a1917'
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '12px 14px',
      border: '1px solid #e8e6e0',
    }}>
      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: valueColor, letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}


function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: '#666',
      margin: '8px 0 10px', letterSpacing: '.02em',
    }}>
      {children}
    </div>
  )
}


// ── Session 卡片（場次列表單元）──────────────────────────

function SessionCard({
  summary, onClick,
}: {
  key?: string | number
  summary: CaptainSessionSummary
  onClick: () => void
}) {
  const { session, isPast, isToday, seasonPlayerCount, substituteCount, walkInCount, expectedRevenue } = summary
  const total = seasonPlayerCount + substituteCount + walkInCount

  const stateColor = isToday ? { bg: '#dcfce7', fg: '#15803d', label: '今天' }
    : isPast ? { bg: '#f3f4f6', fg: '#6b7280', label: '已結束' }
    : { bg: '#dbeafe', fg: '#1e40af', label: '未來' }

  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e8e6e0',
        borderRadius: 10, padding: '12px 14px',
        textAlign: 'left', cursor: 'pointer',
        opacity: isPast ? 0.7 : 1,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {formatDateShort(session.sessionDate)}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: stateColor.bg, color: stateColor.fg,
            padding: '2px 7px', borderRadius: 999,
          }}>
            {stateColor.label}
          </span>
          {session.acEnabled && (
            <span style={{ fontSize: 10, color: '#0891b2' }}>❄ 開冷氣</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {session.startTime}–{session.endTime}
          {' · '}
          <span>共 {total} 人</span>
          {expectedRevenue > 0 && (
            <>
              {' · '}
              <span style={{ color: '#dc2626', fontWeight: 600 }}>
                應收 {moneyText(expectedRevenue)}
              </span>
            </>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          季打 {seasonPlayerCount}{substituteCount > 0 ? ` · 補位 ${substituteCount}` : ''}{walkInCount > 0 ? ` · 臨打 ${walkInCount}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 16, color: '#bbb' }}>›</div>
    </button>
  )
}


// ════════════════════════════════════════════════════════════
// Session Detail View — 場次名單詳情 + 操作（請假 / 加臨打）
// ════════════════════════════════════════════════════════════

function SessionDetailView({
  sessionId, rentalId, onBack,
}: {
  sessionId: string
  rentalId: string
  onBack: () => void
}) {
  // useStoreSync 在頂層 CaptainPortalPage 已呼叫，會傳導到此元件
  const detail = getCaptainSessionDetail(sessionId, rentalId)

  // 含請假者的季打名單（直接從 store 即時讀取）
  // 注意：detail.seasonPlayers 會過濾掉 cancelled，但主揪需要看到請假者以便取消請假
  const seasonPlayersWithLeave = useMemo(
    () => listSessionSeasonPlayersWithLeave(sessionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, detail?.session.id], // detail 變動時也 recompute
  )

  if (!detail) {
    return (
      <div style={{ paddingTop: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>❌</div>
        <p style={{ color: '#888', marginTop: 8 }}>找不到此場次</p>
        <button onClick={onBack} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
          ← 返回
        </button>
      </div>
    )
  }

  // 動態計算 — substitutes + walkIns 都已從 store 即時讀取，包含主揪剛加的
  const effectiveSubstitutes = detail.substitutes.length
  const effectiveWalkIns = detail.walkIns.length
  const dynamicExpected = (effectiveSubstitutes + effectiveWalkIns) * detail.feePerPaidPerson

  // 階段 10：請假 / 取消請假 handler 移到 SeasonPlayerLeaveRow 內，
  //          以支援 per-row 樂觀鎖 baseUpdatedAt + ConflictBanner（同 stage 9 transfers pattern）

  const handleAddWalkIn = () => {
    const name = window.prompt('臨打／補位姓名')
    if (!name?.trim()) return
    const r = captainAddWalkIn({ rentalId, sessionId, name: name.trim() })
    if (!r.ok) {
      alert(`⚠️ ${r.reason}`)
      return
    }
    // 成功 — 不彈 alert，新人會立即出現在臨打區塊
  }

  return (
    <>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: '#666',
          padding: '4px 0', fontSize: 13, cursor: 'pointer',
          marginBottom: 12,
        }}>
        ← 返回場次列表
      </button>

      {/* 場次標題 */}
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
        {formatDateLong(detail.session.sessionDate)}
      </h1>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
        {detail.session.startTime}–{detail.session.endTime} · {detail.rental.venueName}
        {detail.session.acEnabled && <> · <span style={{ color: '#0891b2' }}>❄ 開冷氣（每位 +{moneyText(detail.session.acFee)}）</span></>}
      </div>

      {/* 應收動態大字 */}
      <div style={{
        background: '#fff', border: '1px solid #e8e6e0',
        borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.05em', marginBottom: 6 }}>
          本場應收（系統自動計算）
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: dynamicExpected > 0 ? '#dc2626' : '#888', letterSpacing: '-1px', lineHeight: 1 }}>
          {moneyText(dynamicExpected)}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
          = (補位 {effectiveSubstitutes} + 臨打 {effectiveWalkIns}) × {moneyText(detail.feePerPaidPerson)}/人
          <br />
          <span style={{ color: '#aaa' }}>季打人員 {detail.seasonPlayers.length} 名 季初已繳費</span>
        </div>
      </div>

      {/* 季打名單 — 含請假者（cancelled 也顯示，主揪可取消請假）*/}
      <SectionTitle>👥 季打人員（{seasonPlayersWithLeave.filter(r => r.status !== 'cancelled').length}{
        seasonPlayersWithLeave.some(r => r.status === 'cancelled')
          ? ` · 請假 ${seasonPlayersWithLeave.filter(r => r.status === 'cancelled').length}`
          : ''
      }）</SectionTitle>
      {seasonPlayersWithLeave.length === 0 ? (
        <EmptyHint
          text={
            detail.rental.status === 'pending'
              ? '此場無季打人員（季租單尚未繳款啟動）'
              : '此場無季打人員報到'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {seasonPlayersWithLeave.map(reg => (
            <SeasonPlayerLeaveRow
              key={reg.id}
              reg={reg}
              rentalId={rentalId}
              isPast={detail.isPast}
            />
          ))}
        </div>
      )}

      {/* 補位 */}
      {detail.substitutes.length > 0 && (
        <>
          <SectionTitle>🔄 補位（{detail.substitutes.length}）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {detail.substitutes.map(reg => (
              <RosterRow key={reg.id} reg={reg} isPast={detail.isPast} subType="substitute" />
            ))}
          </div>
        </>
      )}

      {/* 臨打（含主揪剛加入的，store 直接重 render 進來）*/}
      {detail.walkIns.length > 0 && (
        <>
          <SectionTitle>🎫 臨打（{detail.walkIns.length}）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {detail.walkIns.map(reg => (
              <RosterRow key={reg.id} reg={reg} isPast={detail.isPast} subType="walkIn" />
            ))}
          </div>
        </>
      )}

      {/* 加臨打 CTA */}
      {!detail.isPast && (
        <button
          onClick={handleAddWalkIn}
          style={{
            width: '100%', padding: '13px 16px',
            background: '#1a1917', color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            marginBottom: 24,
          }}>
          + 加臨打 / 補位
        </button>
      )}
    </>
  )
}


function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      background: '#fafaf7', border: '1px dashed #ddd',
      borderRadius: 8, padding: 14, textAlign: 'center',
      fontSize: 12, color: '#999', marginBottom: 16,
    }}>
      {text}
    </div>
  )
}


// ── Roster row（單筆名單） ─────────────────────────────────

// ── 階段 10：季打人員一行（含樂觀鎖 baseUpdatedAt + ConflictBanner）─────
// 包裝 RosterRow 加上「請假 / 取消請假」mutation 流程。
// 每筆 reg 各自一份 baseUpdatedAt snapshot — 雙開分頁、員工 + 主揪同時操作時可正確擋衝突。
// （pattern 同 stage 9 /products/transfers 的 TransferRow）

function SeasonPlayerLeaveRow({
  reg, rentalId, isPast,
}: {
  key?: string | number
  reg: RegistrationWithCustomer
  rentalId: string
  isPast: boolean
}) {
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(reg.updatedAt)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  useEffect(() => {
    // store 變動且非衝突狀態 → sync snapshot（讓下次 mutation 用新 base）
    if (!conflict && reg.updatedAt !== baseUpdatedAt) {
      setBaseUpdatedAt(reg.updatedAt)
    }
  }, [reg.updatedAt, conflict, baseUpdatedAt])
  const reloadSnapshot = () => {
    setConflict(null)
    setBaseUpdatedAt(reg.updatedAt)
  }

  const handleLeave = () => {
    const isCurrentlyLeft = reg.status === 'cancelled'
    const result = isCurrentlyLeft
      ? captainUnmarkLeave({ rentalId, registrationId: reg.id, baseUpdatedAt })
      : captainMarkLeave({ rentalId, registrationId: reg.id, baseUpdatedAt })

    if (isConflictResult(result)) {
      setConflict(result)
      return
    }
    if (!result.ok) {
      alert(`⚠️ ${result.reason}`)
      return
    }
    // 成功 — store 自動 re-render，UI 跟著變
  }

  return (
    <>
      <RosterRow
        reg={reg}
        isPast={isPast}
        onLeave={handleLeave}
        onLeaveStatus={reg.status === 'cancelled' ? 'left' : 'attending'}
      />
      {conflict && (
        <ConflictBanner conflict={conflict} onReload={reloadSnapshot} />
      )}
    </>
  )
}


function RosterRow({
  reg, isPast, onLeave, onLeaveStatus, subType,
}: {
  key?: string | number
  reg: RegistrationWithCustomer
  isPast: boolean
  onLeave?: () => void
  onLeaveStatus?: 'attending' | 'left'
  subType?: 'substitute' | 'walkIn'
}) {
  const isLeft = onLeaveStatus === 'left'

  return (
    <div style={{
      background: '#fff', border: '1px solid #e8e6e0',
      borderRadius: 8, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      opacity: isLeft ? 0.6 : 1,
      textDecoration: isLeft ? 'line-through' : 'none',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{reg.customer.name}</span>
          <SkillPill level={reg.customer.skillLevel ?? 'N'} />
          {isLeft && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: '#fee2e2', color: '#991b1b',
              padding: '2px 6px', borderRadius: 4,
            }}>
              請假
            </span>
          )}
          {subType === 'substitute' && (
            <span style={{ fontSize: 10, color: '#0369a1' }}>補</span>
          )}
          {subType === 'walkIn' && (
            <span style={{ fontSize: 10, color: '#a16207' }}>臨</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {reg.customer.phone ?? '—'}
        </div>
      </div>
      {!isPast && onLeave && (
        <button
          onClick={onLeave}
          style={{
            padding: '6px 11px', fontSize: 12, fontWeight: 500,
            background: isLeft ? '#fee2e2' : '#f5f4f0',
            color: isLeft ? '#991b1b' : '#1a1917',
            border: '1px solid', borderColor: isLeft ? '#fca5a5' : '#e0ddd5',
            borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          {isLeft ? '取消請假' : '標記請假'}
        </button>
      )}
    </div>
  )
}


function SkillPill({ level }: { level: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    S: { bg: '#fce7f3', fg: '#9d174d' },
    A: { bg: '#dbeafe', fg: '#1e40af' },
    B: { bg: '#dcfce7', fg: '#15803d' },
    C: { bg: '#fef3c7', fg: '#92400e' },
    D: { bg: '#f3f4f6', fg: '#4b5563' },
    N: { bg: '#f5f4f0', fg: '#888' },
  }
  const c = colors[level] ?? colors.D
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      background: c.bg, color: c.fg,
      padding: '1px 6px', borderRadius: 4,
    }}>
      {SKILL_LABEL[level] ?? level}
    </span>
  )
}


// ── 頁尾說明 ───────────────────────────────────────────────

function FooterNote({ token }: { token: string }) {
  return (
    <div style={{
      marginTop: 32, paddingTop: 16,
      borderTop: '1px solid #e8e6e0',
      fontSize: 11, color: '#888', lineHeight: 1.6,
    }}>
      此頁面是您的主揪專屬連結，請勿外流。<br />
      連結 token：<code style={{ background: '#f5f4f0', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>{token.slice(0, 12)}…</code>
    </div>
  )
}
