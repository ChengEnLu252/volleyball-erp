'use client'

import { use, useEffect, useState } from 'react'
import {
  getSelfCheckinSessionData,
  customerReportSelfPayment,
  type SelfCheckinSessionData,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { PaymentMethod, ConflictResult } from '@/types'
import EvidenceUpload from '@/components/EvidenceUpload'
import ConflictBanner from '@/components/ConflictBanner'

// ── helpers ──────────────────────────────────────────────────

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(dateStr + 'T00:00:00Z')
  return `${y} 年 ${m} 月 ${d} 日（${WEEKDAY[date.getUTCDay()]}）`
}

function money(n: number): string {
  return `$${n.toLocaleString()}`
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:     '現金（投錢箱）',
  transfer: '轉帳',
  online:   '線上付款',
}

const METHOD_ICON: Record<PaymentMethod, string> = {
  cash:     '💵',
  transfer: '🏦',
  online:   '📱',
}


// ════════════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════════════

export default function SelfCheckinPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)

  // 訂閱 store（階段 5 合併後單一），自行 hydrate
  useStoreSync()
  useEffect(() => {
    hydrateStore()
  }, [])

  const data = getSelfCheckinSessionData(sessionId)

  // 隱藏 ERP chrome
  const hideErpChrome = (
    <style>{`
      #sidebar, #mobile-topbar, [data-testid="impersonation-banner"] { display: none !important; }
      body { background: #f5f4f0 !important; }
    `}</style>
  )

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {hideErpChrome}
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>❓</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>找不到場次</h1>
          <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
            此連結可能已失效，或場次並非「無人場次」自助回報範圍。
            <br />
            請聯絡館方確認。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', padding: '20px 16px 40px' }}>
      {hideErpChrome}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Header data={data} />
        <PaymentInfoCard data={data} />
        <RegistrationList data={data} />
        <FooterNote />
      </div>
    </div>
  )
}


// ── 標頭 ─────────────────────────────────────────────────────

function Header({ data }: { data: SelfCheckinSessionData }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 18, paddingTop: 8 }}>
      <div style={{
        display: 'inline-block', padding: '4px 12px', background: '#fef3c7',
        color: '#92400e', borderRadius: 12, fontSize: 11, fontWeight: 600,
        marginBottom: 10, border: '1px solid #fcd34d',
      }}>
        🚪 無人場次自助 Check-in
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#1a1917' }}>
        {data.venueName}
      </h1>
      <div style={{ fontSize: 13, color: '#666' }}>
        {fmtDate(data.sessionDate)} · {data.startTime}–{data.endTime}
      </div>
    </div>
  )
}


// ── 付款資訊（金額 / 投錢箱說明） ───────────────────────────

function PaymentInfoCard({ data }: { data: SelfCheckinSessionData }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
      border: '1px solid #e8e6e0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#888' }}>應繳金額（每人）</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#1a1917' }}>{money(data.totalAmount)}</span>
      </div>
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.7, borderTop: '1px solid #f5f4f0', paddingTop: 10 }}>
        場地費 {money(data.courtFee)}
        {data.acEnabled && <> + 冷氣費 {money(data.acFee)}</>}
      </div>
      <div style={{
        marginTop: 12, padding: '10px 12px', background: '#fef3c7',
        borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.6,
      }}>
        💵 投錢箱位於場館入口櫃台<br />
        🏦 轉帳完成後請上傳截圖（系統會自動對帳）<br />
        ⚠️ 老闆會抽查，誠實回報是運動精神的基本
      </div>
    </div>
  )
}


// ── 報名清單 + 自助按鈕 ──────────────────────────────────────

function RegistrationList({ data }: { data: SelfCheckinSessionData }) {
  const total = data.payableRegistrations.length
  const paid  = data.payableRegistrations.filter(r => r.selfReportedPaid).length

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
      border: '1px solid #e8e6e0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>本場應繳人員</div>
        <div style={{ fontSize: 12, color: '#888' }}>
          {paid} / {total} 已回報
        </div>
      </div>

      {total === 0 && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          本場無臨打/補位人員
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.payableRegistrations.map(r => (
          <div key={r.registrationId}>
            <RegistrationRow reg={r} sessionId={data.sessionId} />
          </div>
        ))}
      </div>
    </div>
  )
}

function RegistrationRow({
  reg, sessionId,
}: {
  reg: SelfCheckinSessionData['payableRegistrations'][number]
  sessionId: string
}) {
  const [modalOpen, setModalOpen] = useState(false)

  if (reg.selfReportedPaid) {
    const reportedAt = reg.selfReportedAt ? new Date(reg.selfReportedAt) : null
    return (
      <div style={{
        padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1917' }}>
            ✅ {reg.customerName}
          </div>
          <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
            已回報 · {METHOD_LABEL[reg.selfPaymentMethod ?? 'cash']}
            {reportedAt && (
              <> · {reportedAt.getMonth() + 1}/{reportedAt.getDate()} {String(reportedAt.getHours()).padStart(2, '0')}:{String(reportedAt.getMinutes()).padStart(2, '0')}</>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>{reg.customerPhoneMasked}</div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        style={{
          padding: 12, background: '#fff', border: '1px solid #e8e6e0',
          borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1917' }}>
            ⏳ {reg.customerName}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            尚未回報 — 點擊回報「我已付款」
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>{reg.customerPhoneMasked}</div>
      </button>

      {modalOpen && (
        <SelfReportModal
          reg={reg}
          sessionId={sessionId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}


// ── 自助回報 modal ───────────────────────────────────────────

function SelfReportModal({
  reg, sessionId, onClose,
}: {
  reg: SelfCheckinSessionData['payableRegistrations'][number]
  sessionId: string
  onClose: () => void
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  /** 上傳成功後的 evidence id（evd_xxx）；尚未上傳則為 '' */
  const [evidenceId, setEvidenceId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 階段 9：樂觀鎖 snapshot — 雙開分頁、員工同時補入帳等場景
  // baseUpdatedAt 開 modal 那一刻就 freeze；conflict 出現就停留直到 reload
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(reg.updatedAt)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  useEffect(() => {
    if (!conflict && reg.updatedAt !== baseUpdatedAt) {
      setBaseUpdatedAt(reg.updatedAt)
    }
  }, [reg.updatedAt, conflict, baseUpdatedAt])
  const reloadSnapshot = () => {
    setConflict(null)
    setBaseUpdatedAt(reg.updatedAt)
  }

  function submit() {
    setSubmitting(true)
    setErr(null)
    // 轉帳：優先用已上傳的 evidence id；若使用者沒上傳則退回 legacy 字串
    const evidenceValue: string | null =
      method === 'transfer'
        ? (evidenceId || `transfer_${reg.registrationId}.jpg`)
        : null
    const result = customerReportSelfPayment({
      sessionId,
      registrationId: reg.registrationId,
      method,
      evidence: evidenceValue,
      baseUpdatedAt, // 階段 9
    })
    setSubmitting(false)
    if (!result.ok) {
      // 樂觀鎖衝突 → ConflictBanner 接手，不關 modal
      if ('conflict' in result && result.conflict) {
        setConflict(result)
        return
      }
      setErr(result.reason)
      return
    }
    // store mutation 已 notify，重新 render；關閉 modal
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: 22,
          maxWidth: 420, width: '100%',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          我已付款
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          {reg.customerName} · {reg.customerPhoneMasked} · {money(reg.expectedAmount)}
        </div>

        {conflict && (
          <div style={{ marginBottom: 14 }}>
            <ConflictBanner conflict={conflict} onReload={reloadSnapshot} />
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>付款方式</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {(['cash', 'transfer', 'online'] as PaymentMethod[]).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              style={{
                padding: '10px 12px', borderRadius: 8,
                border: method === m ? '2px solid #1a1917' : '1px solid #e8e6e0',
                background: method === m ? '#f5f4f0' : '#fff',
                cursor: 'pointer', textAlign: 'left',
                fontSize: 13,
              }}
            >
              <span style={{ marginRight: 8 }}>{METHOD_ICON[m]}</span>
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        {method === 'transfer' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              轉帳截圖（選擇圖片上傳）
            </div>
            <EvidenceUpload
              sourceType="self_payment"
              sourceId={reg.registrationId}
              uploadedByName={reg.customerName}
              onUploaded={(id) => setEvidenceId(id)}
              onError={(reason) => setErr(reason)}
              onUnavailable={() => {
                // 此瀏覽器不支援 IndexedDB；evidence 退回 legacy 字串 fallback（submit 自動處理）
              }}
            />
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              階段 8：圖片存進瀏覽器 IndexedDB（不會上傳到任何伺服器）
            </div>
          </div>
        )}

        {err && (
          <div style={{
            background: '#fee2e2', color: '#991b1b', padding: '8px 10px',
            borderRadius: 8, fontSize: 12, marginBottom: 10,
          }}>
            ⚠️ {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: '1px solid #e8e6e0', background: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8,
              border: 'none', background: '#1a1917', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {submitting ? '提交中…' : '確認回報'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── 頁腳 ─────────────────────────────────────────────────────

function FooterNote() {
  return (
    <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', lineHeight: 1.7, padding: '8px 0' }}>
      回報後資料即時同步管理端。<br />
      惡意未回報將被列入可疑名單並失去無人場次資格。
    </div>
  )
}
