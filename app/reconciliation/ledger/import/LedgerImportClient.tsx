'use client'

// 月記帳 Excel 匯入（P2.5 藍本）。上傳 → 解析預覽 → 選球館 → 確認 upsert 進 ledger_days。
// client 只 import server action（解析/匯入皆 server 端 exceljs + Prisma）。

import { useEffect, useRef, useState, useTransition } from 'react'
import { ReconHeader, StatCard, Panel } from '@/components/reconciliation/Common'
import {
  parseLedgerExcelAction, importLedgerDaysAction, getImportVenuesAction,
  type ParsedLedgerDay,
} from '@/app/actions/ledger-import'

const WEEKDAY_COLOR = (wd: string) => (wd === '六' || wd === '日' ? '#e85d3a' : '#1a1917')

export default function LedgerImportClient() {
  const [pending, startTransition] = useTransition()
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([])
  const [venueId, setVenueId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<{ months: string[]; days: ParsedLedgerDay[]; unmatchedSlots: string[] } | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => { getImportVenuesAction().then((vs) => { setVenues(vs); setVenueId((v) => v || vs[0]?.id || '') }) }, [])

  function onParse() {
    setMsg(null); setDone(null); setParsed(null)
    const f = fileRef.current?.files?.[0]
    if (!f) { setMsg({ type: 'err', text: '請先選擇 Excel 檔' }); return }
    const fd = new FormData(); fd.append('file', f)
    startTransition(async () => {
      const res = await parseLedgerExcelAction(fd)
      if (!res.ok) { setMsg({ type: 'err', text: res.error }); return }
      setParsed({ months: res.months, days: res.days, unmatchedSlots: res.unmatchedSlots })
      setMsg({ type: 'ok', text: `解析成功：${res.months.length} 個月分頁、${res.days.length} 天` })
    })
  }

  function onImport() {
    if (!parsed || !venueId) return
    setMsg(null)
    startTransition(async () => {
      const res = await importLedgerDaysAction({ venueId, days: parsed.days })
      if (!res.ok) { setMsg({ type: 'err', text: res.error }); return }
      setDone(res.imported)
      setMsg({ type: 'ok', text: `已匯入 ${res.imported} 天到「${venues.find((v) => v.id === venueId)?.name}」` })
    })
  }

  const totalCourt = parsed?.days.reduce((s, d) => s + d.courtTotal, 0) ?? 0
  const reportedDays = parsed?.days.filter((d) => d.reported).length ?? 0

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.imp-wrap{padding-top:64px !important}.imp-stats{grid-template-columns:repeat(2,1fr)!important}}`}</style>
      <div className="imp-wrap" style={{ opacity: pending ? 0.6 : 1 }}>
        <ReconHeader
          title="月記帳 Excel 匯入"
          subtitle="上傳對方「多爾森健康」月記帳 Excel（時段×日期，7 館同格式）→ 解析預覽 → 確認匯入 ledger_days"
          backTo="/reconciliation/ledger"
          actions={<a href="/reconciliation/ledger" style={{ fontSize: 13, color: '#10b981', textDecoration: 'none', fontWeight: 600, border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 12px', background: '#ecfdf5' }}>← 回月記帳</a>}
        />

        {msg && (
          <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 10, fontSize: 13, background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
            {msg.type === 'ok' ? '✅ ' : '⚠️ '}{msg.text}
          </div>
        )}

        <Panel title="1. 上傳檔案">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0' }}>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              style={{ fontSize: 13 }} />
            <button onClick={onParse} disabled={pending} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: pending ? 'default' : 'pointer', background: '#1a1917', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {pending ? '解析中…' : '解析預覽'}
            </button>
            {fileName && <span style={{ fontSize: 12, color: '#888' }}>{fileName}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>＊月分頁需命名為 YYYYMM（如 202601）；解析後不會立即寫入，請於下方確認。</div>
        </Panel>

        {parsed && (
          <>
            <div className="imp-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '14px 0' }}>
              <StatCard label="月分頁" value={`${parsed.months.length}`} sub={parsed.months.join('、')} accent="#2563eb" />
              <StatCard label="解析天數" value={`${parsed.days.length} 天`} sub={`回報完畢 ${reportedDays} 天`} accent="#10b981" />
              <StatCard label="場地費加總" value={`$${totalCourt.toLocaleString()}`} sub="各日時段加總" accent="#7c6af7" />
              <StatCard label="未對應時段" value={`${parsed.unmatchedSlots.length}`} sub={parsed.unmatchedSlots.length ? '見下方警告' : '全部對應'} intent={parsed.unmatchedSlots.length ? 'danger' : 'default'} accent="#f59e0b" />
            </div>

            {parsed.unmatchedSlots.length > 0 && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#9a3412', marginBottom: 12 }}>
                ⚠️ 下列時段標籤無法對應到系統時段，將不計入場地費：{parsed.unmatchedSlots.join('、')}。可調整 Excel 標籤或回報我們補對應。
              </div>
            )}

            <Panel title="2. 選擇匯入球館 + 確認">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0' }}>
                <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button onClick={onImport} disabled={pending || !venueId} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: pending ? 'default' : 'pointer', background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  {pending ? '匯入中…' : `確認匯入 ${parsed.days.length} 天`}
                </button>
                {done != null && <span style={{ fontSize: 13, color: '#0d9488', fontWeight: 600 }}>✓ 已匯入 {done} 天</span>}
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>＊同一館同一天已存在的記帳會被覆蓋（upsert）。</div>
            </Panel>

            <Panel title="3. 預覽（前 60 天）">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0ede6', textAlign: 'right' }}>
                      <th style={{ ...th, textAlign: 'left' }}>日期</th>
                      <th style={th}>場地費</th><th style={th}>商品</th><th style={th}>零食</th><th style={th}>飲料</th>
                      <th style={th}>季打</th><th style={th}>包場</th><th style={th}>冷氣費</th><th style={th}>退款</th>
                      <th style={th}>冷氣度數</th><th style={{ ...th, textAlign: 'center' }}>回報</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.days.slice(0, 60).map((d) => (
                      <tr key={d.date} style={{ borderBottom: '1px solid #f7f6f2' }}>
                        <td style={{ ...td, textAlign: 'left', whiteSpace: 'nowrap', color: WEEKDAY_COLOR(d.weekday) }}>{d.date}（{d.weekday}）</td>
                        <td style={td}>{d.courtTotal.toLocaleString()}</td>
                        <td style={td}>{d.merch.toLocaleString()}</td><td style={td}>{d.snacks.toLocaleString()}</td><td style={td}>{d.drinks.toLocaleString()}</td>
                        <td style={td}>{d.seasonFee.toLocaleString()}</td><td style={td}>{d.privatePrepay.toLocaleString()}</td><td style={td}>{d.acFee.toLocaleString()}</td><td style={td}>{d.refund.toLocaleString()}</td>
                        <td style={td}>{d.acDegrees.toLocaleString()}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{d.reported ? '✓' : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.days.length > 60 && <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>（僅預覽前 60 天，匯入會處理全部 {parsed.days.length} 天）</div>}
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 7px', fontSize: 11, fontWeight: 600, color: '#888', textAlign: 'right', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '7px 7px', textAlign: 'right', verticalAlign: 'middle' }
