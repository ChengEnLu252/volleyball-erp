import { getDashboard } from '@/data/mock'
import AiSection from '@/components/AiSection'

export default async function DashboardPage() {
  const data = await getDashboard()

  return (
    <div style={{ padding: '16px' }}>
      <style>{`
        @media (max-width: 768px) {
          .dash-wrap { padding-top: 64px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .main-grid  { grid-template-columns: 1fr !important; }
          .unpaid-grid{ grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="dash-wrap" style={{ paddingTop: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>今日總覽</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>

        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="今日總收入"   value={`$${data.totalRevenue.toLocaleString()}`} sub="↑ 較昨日 +8.3%"   accent="#d4a843" />
          <StatCard label="今日出席人次" value={`${data.totalPlayers} 人`}                sub="滿場率 72%"        accent="#2563eb" />
          <StatCard label="進行中場次"   value={`${data.totalSessions} 場`}               sub="共 5 館"           accent="#059669" />
          <StatCard label="未付款人數"   value={`${data.totalUnpaid} 人`}                 sub={`待收 $${data.venues.reduce((s,v) => s + v.unpaidAmount, 0).toLocaleString()}`} accent="#e85d3a" />
        </div>

        <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12, marginBottom: 12 }}>
          <Panel title="各館即時狀況">
            {data.venues.map(venue => (
              <div key={venue.venueId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: '1px solid #f0ede6', flexWrap: 'wrap',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: VENUE_COLOR[venue.venueId], flexShrink: 0 }} />
                <div style={{ flex: 1, fontWeight: 500, fontSize: 13, minWidth: 50 }}>{venue.venueName}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>${venue.totalRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{venue.totalPlayers} 人</div>
                {venue.unpaidCount > 0 && (
                  <span style={{ fontSize: 11, background: '#fff3cd', color: '#856404', padding: '2px 7px', borderRadius: 8 }}>未付 {venue.unpaidCount}</span>
                )}
                {venue.giftRatio > 30 && (
                  <span style={{ fontSize: 11, background: '#fce7f3', color: '#9d174d', padding: '2px 7px', borderRadius: 8 }}>⚠ 贈送偏高</span>
                )}
              </div>
            ))}
          </Panel>

          <Panel title={`異常通知 (${data.alerts.length})`}>
            {data.alerts.map(alert => (
              <div key={alert.id} style={{ padding: '9px 0', borderBottom: '1px solid #f0ede6' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e85d3a', marginBottom: 2 }}>{alert.venueName}</div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{alert.message}</div>
              </div>
            ))}
          </Panel>
        </div>

        <Panel title={`未付款名單（待收 $${data.venues.reduce((s,v) => s + v.unpaidAmount, 0).toLocaleString()}）`}>
          <div className="unpaid-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {data.unpaidRegistrations.map(r => (
              <div key={r.registrationId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: '#fafaf8', borderRadius: 8, border: '1px solid #f0ede6',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: '#e8e6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600, color: '#5b4fd8', flexShrink: 0,
                }}>
                  {r.customerName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.customerName}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{r.venueName} · {r.sessionTime}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: r.waitedMinutes > 120 ? '#e85d3a' : '#1a1917', flexShrink: 0 }}>
                  ${r.amount}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <AiSection />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string, value: string, sub: string, accent: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e8e6e0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{sub}</div>
      <div style={{ position: 'absolute', top: 14, right: 14, width: 4, height: 32, borderRadius: 2, background: accent }} />
    </div>
  )
}

function Panel({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0ede6', fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ padding: '4px 16px 12px' }}>{children}</div>
    </div>
  )
}

const VENUE_COLOR: Record<string, string> = {
  v1: '#7c6af7',
  v2: '#0ea5e9',
  v3: '#f59e0b',
  v4: '#10b981',
  v5: '#f43f5e',
  v6: '#06b6d4',
}