'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveUser, rejectUser } from '@/app/actions/auth'
import type { PendingUserRow } from '@/data/server/queries'
import { COLORS } from '@/components/theme/tokens'

const ROLE_LABEL = { manager: '館長', staff: '工讀生' } as const

export default function ApprovalsClient({ initialPending }: { initialPending: PendingUserRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const act = async (id: string, kind: 'approve' | 'reject') => {
    setBusyId(id); setError('')
    const res = kind === 'approve' ? await approveUser(id) : await rejectUser(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    router.refresh() // 重新抓 server 端待審清單
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink900, margin: '0 0 4px' }}>帳號審核</h1>
      <div style={{ fontSize: 13, color: COLORS.ink500, marginBottom: 20 }}>
        自助註冊的館長 / 工讀生需經您審核後才能登入。
      </div>

      {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {initialPending.length === 0 ? (
        <div style={{
          background: '#fff', border: `1px dashed ${COLORS.pink200}`, borderRadius: 12,
          padding: '40px 20px', textAlign: 'center', color: COLORS.ink300, fontSize: 14,
        }}>
          目前沒有待審核的帳號 🎉
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {initialPending.map(u => (
            <div key={u.id} style={{
              background: '#fff', border: `1px solid ${COLORS.pink100}`, borderRadius: 12,
              padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink900 }}>
                  {u.name}
                  <span style={{ fontSize: 12, color: COLORS.ink300, fontWeight: 600, marginLeft: 8 }}>
                    代號 {u.username}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.ink500, marginTop: 3 }}>
                  {u.venues.map(v => `${ROLE_LABEL[v.role]} · ${v.venueName}`).join('、') || '（未指定球館）'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => act(u.id, 'approve')} disabled={busyId === u.id} style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff',
                  fontWeight: 700, fontSize: 13, opacity: busyId === u.id ? 0.6 : 1,
                }}>通過</button>
                <button onClick={() => act(u.id, 'reject')} disabled={busyId === u.id} style={{
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  background: '#fff', color: COLORS.danger, border: `1.5px solid ${COLORS.pink200}`,
                  fontWeight: 700, fontSize: 13, opacity: busyId === u.id ? 0.6 : 1,
                }}>退回</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
