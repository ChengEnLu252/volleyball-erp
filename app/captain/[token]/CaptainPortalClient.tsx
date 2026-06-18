'use client'

// 主揪 portal 畫面（client）。資料由 server 殼以 props 傳入（CaptainPortalBundle）；
// 請假/加臨打走 server action，成功後 router.refresh() 重抓 server 資料。
// 樂觀鎖：每列 baseUpdatedAt snapshot + ConflictBanner（保留既有 UX）。

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isConflictResult } from '@/data/api'
import type { ConflictResult } from '@/types'
import {
  captainMarkLeaveAction, captainUnmarkLeaveAction, captainAddWalkInAction,
} from '@/app/actions/captain'
import type { CaptainPortalBundle, CaptainSessionBundle, CaptainRegRow } from '@/data/server/queries'
import ConflictBanner from '@/components/ConflictBanner'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const w = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  return `${m}/${d}（${WEEKDAY[w]}）`
}
function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const w = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  return `${y} 年 ${m} 月 ${d} 日（${WEEKDAY[w]}）`
}
function moneyText(n: number): string { return `$${n.toLocaleString()}` }
const SKILL_LABEL: Record<string, string> = { S: 'S 級', A: 'A 級', B: 'B 級', C: 'C 級', D: 'D 級', N: '新手' }


export default function CaptainPortalClient({
  token, bundle,
}: {
  token: string
  bundle: CaptainPortalBundle | null
}) {
  const router = useRouter()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const onChanged = () => router.refresh()

  const hideErpChrome = (
    <style>{`
      #sidebar, #mobile-topbar, [data-testid="impersonation-banner"] { display: none !important; }
      body { background: #fafaf7 !important; }
    `}</style>
  )

  if (!bundle) {
    return <Shell>{hideErpChrome}<NotFoundScreen /></Shell>
  }
  if (bundle.tokenStatus === 'expired') {
    return <Shell>{hideErpChrome}<ExpiredScreen bundle={bundle} /></Shell>
  }

  const selected = selectedSessionId
    ? bundle.sessions.find(s => s.session.id === selectedSessionId) ?? null
    : null

  return (
    <Shell>
      {hideErpChrome}
      {selected ? (
        <SessionDetailView
          token={token}
          sb={selected}
          rentalStatus={bundle.rental.status}
          venueName={bundle.rental.venueName ?? ''}
          onBack={() => setSelectedSessionId(null)}
          onChanged={onChanged}
        />
      ) : (
        <OverviewView bundle={bundle} onSelectSession={setSelectedSessionId} />
      )}
    </Shell>
  )
}


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', padding: '16px 14px 80px', minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif',
      color: '#1a1917',
    }}>{children}</div>
  )
}

function NotFoundScreen() {
  return (
    <div style={{ paddingTop: 80, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>主揪連結無效</h1>
      <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
        此連結不存在或格式錯誤。<br />請向您的球館索取最新的主揪連結。
      </p>
    </div>
  )
}

function ExpiredScreen({ bundle }: { bundle: CaptainPortalBundle }) {
  const r = bundle.rental
  return (
    <div style={{ paddingTop: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>連結已過期</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.6 }}>
        嗨 {r.captainName}，<br />
        您的主揪連結已於 {r.accessTokenExpiresAt.split('T')[0]} 失效。<br />
        請向 {r.venueName} 索取新季的連結。
      </p>
      <div style={{ fontSize: 12, color: '#666', background: '#f5f4f0', padding: '12px 14px', borderRadius: 8, textAlign: 'left' }}>
        💡 <strong>為什麼會過期？</strong><br />
        每季結束後，舊連結會自動失效，避免外流。新季開始時，館長會發送新的連結給您。
      </div>
    </div>
  )
}


// ── Overview ────────────────────────────────────────────────
function OverviewView({
  bundle, onSelectSession,
}: {
  bundle: CaptainPortalBundle
  onSelectSession: (id: string) => void
}) {
  const r = bundle.rental
  const nextSessionDate = bundle.sessions.find(s => !s.isPast)?.session.sessionDate ?? null

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>主揪專屬頁</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>嗨，{r.captainName}</h1>
        <div style={{ fontSize: 13, color: '#666', marginTop: 6, lineHeight: 1.5 }}>
          {r.venueName}・{r.timeslotLabel}<br />
          <span style={{ color: '#888' }}>{r.seasonName}</span>
        </div>
      </div>

      {bundle.isPaymentCritical && <PaymentCriticalBanner bundle={bundle} />}
      {r.status === 'pending' && <PendingActivationNote />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        <MiniStat label="本季場次" value={`${bundle.totalSessions}`} sub={`已過 ${bundle.pastSessions} / 剩 ${bundle.upcomingSessions}`} />
        <MiniStat label="季打人員" value={`${bundle.seasonPlayerCount}`} sub={r.status === 'pending' ? '待繳款後啟動' : '人 / 18'} muted={r.status === 'pending'} />
        <MiniStat label="應繳" value={moneyText(bundle.expectedAmount)} sub="季初一次性" />
        <MiniStat
          label={bundle.isPaymentCritical ? '尚欠' : '已繳清'}
          value={bundle.isPaymentCritical ? moneyText(bundle.outstandingAmount) : '✓'}
          sub={`${(bundle.paidRatio * 100).toFixed(0)}% 已繳`}
          intent={bundle.isPaymentCritical ? 'danger' : 'success'}
        />
      </div>

      {nextSessionDate && <NextSessionHint sessionDate={nextSessionDate} />}

      <SectionTitle>📅 我的本季場次</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {bundle.sessions.map(s => (
          <SessionCard key={s.session.id} sb={s} onClick={() => onSelectSession(s.session.id)} />
        ))}
      </div>

      <FooterNote token={r.accessToken} />
    </>
  )
}

function PaymentCriticalBanner({ bundle }: { bundle: CaptainPortalBundle }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', border: '2px solid #f87171', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', letterSpacing: '.05em', marginBottom: 6 }}>⚠️ 待繳款提醒</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#991b1b', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
        您本季尚欠 {moneyText(bundle.outstandingAmount)}
      </div>
      <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 6, lineHeight: 1.5 }}>
        您已繳 {moneyText(bundle.paidAmount)} / 應繳 {moneyText(bundle.expectedAmount)}（{(bundle.paidRatio * 100).toFixed(0)}%）<br />
        請盡快聯絡 {bundle.rental.venueName} 完成繳費。
      </div>
      <button
        onClick={() => alert(`📞 聯絡 ${bundle.rental.venueName}\n\n（demo 模式：實際版會直接撥電話或開 LINE）`)}
        style={{ marginTop: 10, width: '100%', padding: '11px 14px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        聯絡館方繳款
      </button>
    </div>
  )
}

function PendingActivationNote() {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
      💡 <strong>季租單尚未啟動：</strong>您繳清後，本時段會正式套用「季打人員每場免費」規則。在此之前，每位報到者皆視為臨打。
    </div>
  )
}

function NextSessionHint({ sessionDate }: { sessionDate: string }) {
  const today = new Date().toISOString().split('T')[0]
  const isToday = sessionDate === today
  return (
    <div style={{ background: isToday ? '#dcfce7' : '#eff6ff', border: `1px solid ${isToday ? '#86efac' : '#bfdbfe'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13, fontWeight: 500, color: isToday ? '#14532d' : '#1e40af' }}>
      {isToday ? '🏐 今天就是場次日！' : `📅 下一場：${formatDateLong(sessionDate)}`}
    </div>
  )
}

function MiniStat({ label, value, sub, intent, muted }: { label: string; value: string; sub?: string; intent?: 'danger' | 'success'; muted?: boolean }) {
  const valueColor = intent === 'danger' ? '#dc2626' : intent === 'success' ? '#15803d' : muted ? '#888' : '#1a1917'
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e8e6e0' }}>
      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: valueColor, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#666', margin: '8px 0 10px', letterSpacing: '.02em' }}>{children}</div>
}


// ── Session 卡片 ────────────────────────────────────────────
function SessionCard({ sb, onClick }: { sb: CaptainSessionBundle; onClick: () => void }) {
  const { session, isPast, isToday, seasonPlayerCount, substituteCount, walkInCount, expectedRevenue } = sb
  const total = seasonPlayerCount + substituteCount + walkInCount
  const stateColor = isToday ? { bg: '#dcfce7', fg: '#15803d', label: '今天' }
    : isPast ? { bg: '#f3f4f6', fg: '#6b7280', label: '已結束' }
    : { bg: '#dbeafe', fg: '#1e40af', label: '未來' }

  return (
    <button onClick={onClick} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', opacity: isPast ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{formatDateShort(session.sessionDate)}</span>
          <span style={{ fontSize: 10, fontWeight: 600, background: stateColor.bg, color: stateColor.fg, padding: '2px 7px', borderRadius: 999 }}>{stateColor.label}</span>
          {session.acEnabled && <span style={{ fontSize: 10, color: '#0891b2' }}>❄ 開冷氣</span>}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {session.startTime}–{session.endTime}{' · '}<span>共 {total} 人</span>
          {expectedRevenue > 0 && <>{' · '}<span style={{ color: '#dc2626', fontWeight: 600 }}>應收 {moneyText(expectedRevenue)}</span></>}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          季打 {seasonPlayerCount}{substituteCount > 0 ? ` · 補位 ${substituteCount}` : ''}{walkInCount > 0 ? ` · 臨打 ${walkInCount}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 16, color: '#bbb' }}>›</div>
    </button>
  )
}


// ── Session Detail ──────────────────────────────────────────
function SessionDetailView({
  token, sb, rentalStatus, venueName, onBack, onChanged,
}: {
  token: string
  sb: CaptainSessionBundle
  rentalStatus: string
  venueName: string
  onBack: () => void
  onChanged: () => void
}) {
  const session = sb.session
  const leftCount = sb.seasonPlayersWithLeave.filter(r => r.status === 'cancelled').length
  const attendingSp = sb.seasonPlayersWithLeave.filter(r => r.status !== 'cancelled').length

  const handleAddWalkIn = async () => {
    const name = window.prompt('臨打／補位姓名')
    if (!name?.trim()) return
    const r = await captainAddWalkInAction({ token, sessionId: session.id, name: name.trim() })
    if (!r.ok) { alert(`⚠️ ${r.reason}`); return }
    onChanged()
  }

  return (
    <>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#666', padding: '4px 0', fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
        ← 返回場次列表
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{formatDateLong(session.sessionDate)}</h1>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
        {session.startTime}–{session.endTime} · {venueName}
        {session.acEnabled && <> · <span style={{ color: '#0891b2' }}>❄ 開冷氣（每位 +{moneyText(session.acFee)}）</span></>}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '.05em', marginBottom: 6 }}>本場應收（系統自動計算）</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: sb.expectedRevenue > 0 ? '#dc2626' : '#888', letterSpacing: '-1px', lineHeight: 1 }}>{moneyText(sb.expectedRevenue)}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
          = (補位 {sb.substituteCount} + 臨打 {sb.walkInCount}) × {moneyText(sb.feePerPaidPerson)}/人<br />
          <span style={{ color: '#aaa' }}>季打人員 {sb.seasonPlayerCount} 名 季初已繳費</span>
        </div>
      </div>

      <SectionTitle>👥 季打人員（{attendingSp}{leftCount > 0 ? ` · 請假 ${leftCount}` : ''}）</SectionTitle>
      {sb.seasonPlayersWithLeave.length === 0 ? (
        <EmptyHint text={rentalStatus === 'pending' ? '此場無季打人員（季租單尚未繳款啟動）' : '此場無季打人員報到'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {sb.seasonPlayersWithLeave.map(reg => (
            <SeasonPlayerLeaveRow key={reg.registrationId} token={token} reg={reg} isPast={sb.isPast} onChanged={onChanged} />
          ))}
        </div>
      )}

      {sb.substitutes.length > 0 && (
        <>
          <SectionTitle>🔄 補位（{sb.substitutes.length}）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {sb.substitutes.map(reg => <RosterRow key={reg.registrationId} reg={reg} isPast={sb.isPast} subType="substitute" />)}
          </div>
        </>
      )}

      {sb.walkIns.length > 0 && (
        <>
          <SectionTitle>🎫 臨打（{sb.walkIns.length}）</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {sb.walkIns.map(reg => <RosterRow key={reg.registrationId} reg={reg} isPast={sb.isPast} subType="walkIn" />)}
          </div>
        </>
      )}

      {!sb.isPast && (
        <button onClick={handleAddWalkIn} style={{ width: '100%', padding: '13px 16px', background: '#1a1917', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>
          + 加臨打 / 補位
        </button>
      )}
    </>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ background: '#fafaf7', border: '1px dashed #ddd', borderRadius: 8, padding: 14, textAlign: 'center', fontSize: 12, color: '#999', marginBottom: 16 }}>{text}</div>
}


// ── 季打人員一行（樂觀鎖 + ConflictBanner）──────────────────
function SeasonPlayerLeaveRow({
  token, reg, isPast, onChanged,
}: {
  token: string
  reg: CaptainRegRow
  isPast: boolean
  onChanged: () => void
}) {
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(reg.updatedAt)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!conflict && reg.updatedAt !== baseUpdatedAt) setBaseUpdatedAt(reg.updatedAt)
  }, [reg.updatedAt, conflict, baseUpdatedAt])

  const reloadSnapshot = () => {
    setConflict(null)
    setBaseUpdatedAt(reg.updatedAt)
    onChanged()
  }

  const handleLeave = async () => {
    setBusy(true)
    const isCurrentlyLeft = reg.status === 'cancelled'
    const result = isCurrentlyLeft
      ? await captainUnmarkLeaveAction({ token, registrationId: reg.registrationId, baseUpdatedAt })
      : await captainMarkLeaveAction({ token, registrationId: reg.registrationId, baseUpdatedAt })
    setBusy(false)
    if (isConflictResult(result)) { setConflict(result); return }
    if (!result.ok) { alert(`⚠️ ${result.reason}`); return }
    onChanged()
  }

  return (
    <>
      <RosterRow reg={reg} isPast={isPast} onLeave={busy ? undefined : handleLeave} onLeaveStatus={reg.status === 'cancelled' ? 'left' : 'attending'} />
      {conflict && <ConflictBanner conflict={conflict} onReload={reloadSnapshot} />}
    </>
  )
}

function RosterRow({
  reg, isPast, onLeave, onLeaveStatus, subType,
}: {
  reg: CaptainRegRow
  isPast: boolean
  onLeave?: () => void
  onLeaveStatus?: 'attending' | 'left'
  subType?: 'substitute' | 'walkIn'
}) {
  const isLeft = onLeaveStatus === 'left'
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, opacity: isLeft ? 0.6 : 1, textDecoration: isLeft ? 'line-through' : 'none' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{reg.customerName}</span>
          <SkillPill level={reg.customerSkillLevel ?? 'N'} />
          {isLeft && <span style={{ fontSize: 10, fontWeight: 600, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4 }}>請假</span>}
          {subType === 'substitute' && <span style={{ fontSize: 10, color: '#0369a1' }}>補</span>}
          {subType === 'walkIn' && <span style={{ fontSize: 10, color: '#a16207' }}>臨</span>}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{reg.customerPhone ?? '—'}</div>
      </div>
      {!isPast && onLeave && (
        <button onClick={onLeave} style={{ padding: '6px 11px', fontSize: 12, fontWeight: 500, background: isLeft ? '#fee2e2' : '#f5f4f0', color: isLeft ? '#991b1b' : '#1a1917', border: '1px solid', borderColor: isLeft ? '#fca5a5' : '#e0ddd5', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {isLeft ? '取消請假' : '標記請假'}
        </button>
      )}
    </div>
  )
}

function SkillPill({ level }: { level: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    S: { bg: '#fce7f3', fg: '#9d174d' }, A: { bg: '#dbeafe', fg: '#1e40af' }, B: { bg: '#dcfce7', fg: '#15803d' },
    C: { bg: '#fef3c7', fg: '#92400e' }, D: { bg: '#f3f4f6', fg: '#4b5563' }, N: { bg: '#f5f4f0', fg: '#888' },
  }
  const c = colors[level] ?? colors.D
  return <span style={{ fontSize: 10, fontWeight: 600, background: c.bg, color: c.fg, padding: '1px 6px', borderRadius: 4 }}>{SKILL_LABEL[level] ?? level}</span>
}

function FooterNote({ token }: { token: string }) {
  return (
    <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e8e6e0', fontSize: 11, color: '#888', lineHeight: 1.6 }}>
      此頁面是您的主揪專屬連結，請勿外流。<br />
      連結 token：<code style={{ background: '#f5f4f0', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>{token.slice(0, 12)}…</code>
    </div>
  )
}
