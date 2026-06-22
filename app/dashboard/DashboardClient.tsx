'use client'

// 總覽畫面（client）。資料由 server 殼以 props 傳入（已 scope + server 端忠實重現）。
// 純渲染，不再呼叫 data/api。

import AiSummaryTeaser from '@/components/AiSummaryTeaser'
import QiuQiu from '@/components/QiuQiu'
import { COLORS, FONTS, VENUE_COLOR } from '@/components/theme/tokens'
import type { DashboardBundle } from '@/data/server/queries'

export default function DashboardClient({ bundle }: { bundle: DashboardBundle | null }) {
  if (!bundle) {
    return <div style={{ padding: 24, color: COLORS.ink500 }}>請先登入。</div>
  }
  const { venues, alerts, unpaidRegistrations, stats, insights, isAllVenues } = bundle

  const delta = stats.revenueDelta.deltaPercent
  const deltaSign = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const deltaSub = stats.revenueDelta.prev === 0 ? '昨日無營收資料' : `${deltaSign} 較昨日 ${delta > 0 ? '+' : ''}${delta}%`
  const deltaColor = delta > 0 ? COLORS.success : delta < 0 ? COLORS.danger : COLORS.ink500

  const titleSuffix = isAllVenues || venues.length !== 1 ? '今日總覽' : `${venues[0]?.venueName ?? ''} 今日總覽`
  const todayLabel = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
  const weekdayShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()]

  return (
    <div style={{ padding: '16px', fontFamily: FONTS.sans, position: 'relative' }}>
      <style>{`
        @media (max-width: 768px) {
          .dash-wrap { padding-top: 64px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .main-grid  { grid-template-columns: 1fr !important; }
          .unpaid-grid{ grid-template-columns: 1fr !important; }
          .dash-hero-volli { display: none !important; }
        }
      `}</style>

      <div className="dash-wrap" style={{ paddingTop: 0, position: 'relative' }}>
        <div style={{ marginBottom: 18, position: 'relative', paddingRight: 130 }}>
          <div className="vop-mono" style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, color: COLORS.pink700, letterSpacing: '0.16em', padding: '3px 10px', background: COLORS.pink100, border: `1px solid ${COLORS.pink300}`, borderRadius: 99, marginBottom: 8 }}>
            [ {todayLabel} · {weekdayShort} ]
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.2, color: COLORS.ink900 }}>
            {titleSuffix}{' '}
            <span style={{ color: COLORS.pink500, textShadow: '0 0 18px rgba(255,45,138,0.35)', fontFamily: FONTS.mono, fontSize: 22 }}>/ DASHBOARD ⚡</span>
          </h1>
          <p style={{ fontSize: 13, color: COLORS.ink500, margin: '6px 0 0', lineHeight: 1.5 }}>
            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            {stats.totalSessions > 0 && (<> · 今日有 <span style={{ color: COLORS.pink500, fontWeight: 700 }}>{stats.totalSessions} 場</span> 進行中，球球已就位 ✦</>)}
          </p>
          <div className="dash-hero-volli" style={{ position: 'absolute', top: -4, right: 0, pointerEvents: 'none' }}>
            <QiuQiu variant="full" size={108} rotate={-6} bob />
          </div>
        </div>

        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          <StatCard label="今日總收入" shortLabel="REVENUE" value={`$${stats.totalRevenue.toLocaleString()}`} sub={deltaSub} subColor={deltaColor} accent={COLORS.pink500} />
          <StatCard label="今日出席人次" shortLabel="PLAYERS" value={`${stats.totalPlayers}`} valueSuffix=" 人" sub={`滿場率 ${stats.fillRate}%`} accent={COLORS.purple} />
          <StatCard label="進行中場次" shortLabel="LIVE" value={`${String(stats.totalSessions).padStart(2, '0')}`} valueSuffix=" 場" sub={`共 ${stats.activeVenueCount} 館`} accent={COLORS.cyan} live />
          <StatCard label="未付款人數" shortLabel="UNPAID" value={`${stats.totalUnpaid}`} valueSuffix=" 人" sub={`待收 $${stats.totalUnpaidAmount.toLocaleString()}`} accent={COLORS.amber} />
        </div>

        <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 10, marginBottom: 10 }}>
          <Panel title={isAllVenues ? '各館即時狀況' : '本館即時狀況'} liveIndicator>
            {venues.map(venue => (
              <div key={venue.venueId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px dashed ${COLORS.borderLight}`, flexWrap: 'wrap' }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: VENUE_COLOR[venue.venueId] ?? COLORS.pink400, boxShadow: `0 0 6px ${VENUE_COLOR[venue.venueId] ?? COLORS.pink400}80`, flexShrink: 0 }} />
                <div style={{ flex: 1, fontWeight: 700, fontSize: 13, minWidth: 50, color: COLORS.ink900 }}>{venue.venueName}</div>
                <div className="vop-mono" style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink900 }}>${venue.totalRevenue.toLocaleString()}</div>
                <div className="vop-mono" style={{ fontSize: 11, color: COLORS.ink500 }}>{venue.totalPlayers} 人</div>
                {venue.unpaidCount > 0 && (
                  <span className="vop-mono" style={{ fontSize: 10, background: COLORS.warnBg, color: COLORS.warn, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: `1px solid ${COLORS.warnBorder}` }}>⚠ 未付 {venue.unpaidCount}</span>
                )}
                {venue.giftRatio > 30 && (
                  <span className="vop-mono" style={{ fontSize: 10, background: COLORS.dangerBg, color: COLORS.danger, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: `1px solid ${COLORS.pink300}` }}>⚠ 贈送偏高</span>
                )}
              </div>
            ))}
            {venues.length === 0 && <EmptyState text="您的館今日無資料" />}
          </Panel>

          <Panel title="異常通知" badge={alerts.length}>
            {alerts.map((alert, idx) => (
              <div key={alert.id} style={{ padding: '8px 0', borderBottom: idx < alerts.length - 1 ? `1px dashed ${COLORS.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span className="vop-mono" style={{ fontSize: 9, fontWeight: 800, color: COLORS.pink500 }}>#{String(idx + 1).padStart(3, '0')}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.pink700 }}>{alert.venueName}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.ink700, lineHeight: 1.5 }}>{alert.message}</div>
              </div>
            ))}
            {alerts.length === 0 && <EmptyState text="無異常 · 球球幫你顧好了" showMascot />}
          </Panel>
        </div>

        <Panel title={`未付款名單（待收 $${stats.totalUnpaidAmount.toLocaleString()}）`}>
          <div className="unpaid-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {unpaidRegistrations.map(r => (
              <div key={r.registrationId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: COLORS.pink50, borderRadius: 9, border: `1px solid ${COLORS.pink100}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${COLORS.pink400} 0%, ${COLORS.pink500} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px -2px rgba(255,45,138,0.4)' }}>{r.customerName[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink900 }}>{r.customerName}</div>
                  <div className="vop-mono" style={{ fontSize: 10.5, color: COLORS.ink500, marginTop: 1 }}>{r.venueName} · {r.sessionTime}</div>
                </div>
                <div className="vop-mono" style={{ fontSize: 14, fontWeight: 800, color: r.waitedMinutes > 120 ? COLORS.pink500 : COLORS.ink900, flexShrink: 0 }}>${r.amount}</div>
              </div>
            ))}
            {unpaidRegistrations.length === 0 && <div style={{ gridColumn: '1 / -1' }}><EmptyState text="無未付款 · 收得乾淨溜溜" showMascot /></div>}
          </div>
        </Panel>

        {isAllVenues && <AiSummaryTeaser insights={insights} />}
      </div>
    </div>
  )
}

function StatCard({ label, shortLabel, value, valueSuffix, sub, subColor, accent, live }: { label: string; shortLabel: string; value: string; valueSuffix?: string; sub: string; subColor?: string; accent: string; live?: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: '12px 14px', position: 'relative', overflow: 'visible' }}>
      <span style={{ position: 'absolute', top: -1, left: -1, width: 7, height: 7, borderTop: `1.5px solid ${accent}`, borderLeft: `1.5px solid ${accent}` }} />
      <span style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderTop: `1.5px solid ${accent}`, borderRight: `1.5px solid ${accent}` }} />
      <span style={{ position: 'absolute', bottom: -1, left: -1, width: 7, height: 7, borderBottom: `1.5px solid ${accent}`, borderLeft: `1.5px solid ${accent}` }} />
      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderBottom: `1.5px solid ${accent}`, borderRight: `1.5px solid ${accent}` }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: 40, height: 40, background: `linear-gradient(135deg, ${accent} 0%, transparent 70%)`, borderRadius: '0 12px 0 40px', opacity: 0.14, pointerEvents: 'none' }} />
      <div className="vop-mono" style={{ fontSize: 9, color: accent, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 6 }}>// {shortLabel}</div>
      <div className="vop-mono" style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink900, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}{valueSuffix && <span style={{ fontSize: 13, color: COLORS.ink300, fontWeight: 600 }}>{valueSuffix}</span>}
      </div>
      <div style={{ fontSize: 11, color: subColor ?? COLORS.ink500, marginTop: 5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        {live && <span className="vop-ping" style={{ width: 5, height: 5, borderRadius: '50%', background: accent, display: 'inline-block', boxShadow: `0 0 6px ${accent}` }} />}
        <span>{sub}</span>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, width: 3, height: 26, borderRadius: 2, background: accent, boxShadow: `0 0 6px ${accent}80` }} />
    </div>
  )
}

function Panel({ title, children, liveIndicator, badge }: { title: string; children: React.ReactNode; liveIndicator?: boolean; badge?: number }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden', marginBottom: 10, boxShadow: '0 2px 8px -3px rgba(255,45,138,0.08)' }}>
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${COLORS.pink100}`, background: `linear-gradient(90deg, ${COLORS.pink50} 0%, #fff 80%)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="vop-mono" style={{ fontSize: 10, color: COLORS.pink500, fontWeight: 800 }}>[</span>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink900, letterSpacing: '-0.01em' }}>{title}</div>
          <span className="vop-mono" style={{ fontSize: 10, color: COLORS.pink500, fontWeight: 800 }}>]</span>
        </div>
        {liveIndicator && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="vop-ping" style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.pink500, display: 'inline-block', boxShadow: `0 0 8px ${COLORS.pink500}` }} />
            <span className="vop-mono" style={{ fontSize: 10, fontWeight: 800, color: COLORS.pink500, letterSpacing: '0.1em' }}>LIVE</span>
          </div>
        )}
        {typeof badge === 'number' && (
          <span className="vop-mono" style={{ fontSize: 10, background: `linear-gradient(90deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff', padding: '2px 9px', borderRadius: 99, fontWeight: 800, boxShadow: `0 0 8px rgba(255,45,138,0.45)` }}>{String(badge).padStart(2, '0')}</span>
        )}
      </div>
      <div style={{ padding: '6px 14px 12px' }}>{children}</div>
    </div>
  )
}

function EmptyState({ text, showMascot }: { text: string; showMascot?: boolean }) {
  return (
    <div style={{ padding: '18px 12px', textAlign: 'center', color: COLORS.ink500, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {showMascot && <QiuQiu variant="face" size={44} opacity={0.7} />}
      <span>{text}</span>
    </div>
  )
}
