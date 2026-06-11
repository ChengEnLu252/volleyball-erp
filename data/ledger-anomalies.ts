// ============================================================
// data/ledger-anomalies.ts — 階段 20 M2-1：記帳表異常罰則偵測（規章 6-3）
// ============================================================
// 把「館長記帳品質」變成可罰的異常，併入既有對帳異常清單。
//   - 負帳未填   negative_balance：當日總計為負且無退款明細 → 罰 $500
//   - 營收漏填   revenue_omission：回報完畢卻整日 0 元      → 罰 $100
//   - 匯款金額不符 deposit_mismatch：本月場地費記帳 ≠ 系統   → 罰 $100
// 每日掃描以 negative_balance > revenue_omission 互斥（同日只記一筆，取較重者）。
// deposit_mismatch 為「每館每月」一筆，沿用 getLedgerReconciliation 的場地費對帳差異。
// 資料：data/store.ts 的 LEDGER_DAYS（有種子，可 upsert 持久化）。
// ============================================================

import { getAllLedgerDays } from './store'
import { computeLedgerDerived, getLedgerReconciliation } from './ledger'
import { GENERATED } from './generator'
import {
  LEDGER_PENALTY_DEPOSIT, LEDGER_PENALTY_NEGATIVE, LEDGER_PENALTY_OMISSION,
  LEDGER_ANOMALY_LABEL,
} from '@/types'
import type { LedgerAnomalyKind } from '@/types'

// 避免和 api.ts 互相 import（api 會 import 本檔），這裡用獨立中介型別，
// 由 api.ts 對映成 ReconciliationAnomaly。
export interface LedgerAnomalyRow {
  kind: LedgerAnomalyKind
  venueId: string
  venueName: string
  date?: string
  /** 罰款金額（= 涉及金額） */
  penalty: number
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  /** 串回記帳輸入頁 / 對帳頁的定位字串 */
  linkId: string
}

function venueName(venueId: string): string {
  return GENERATED.venues.find(v => v.id === venueId)?.name ?? venueId
}

/** 偵測單一球館某月的記帳異常 */
export function detectLedgerAnomalies(venueId: string, month: string): LedgerAnomalyRow[] {
  const out: LedgerAnomalyRow[] = []
  const days = getAllLedgerDays()
    .filter(d => d.venueId === venueId && d.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 逐日：負帳未填 / 營收漏填（互斥，取較重者）
  for (const day of days) {
    const dv = computeLedgerDerived(day)
    if (dv.total < 0 && day.refundNote.trim() === '') {
      out.push({
        kind: 'negative_balance', venueId, venueName: venueName(venueId), date: day.date,
        penalty: LEDGER_PENALTY_NEGATIVE, severity: 'high',
        title: `${venueName(venueId)} ${day.date} ${LEDGER_ANOMALY_LABEL.negative_balance}`,
        description: `當日總計 $${dv.total.toLocaleString()}（負值）卻未填退款明細，依規章 6-3 罰 $${LEDGER_PENALTY_NEGATIVE}`,
        linkId: `${venueId}:${day.date}`,
      })
      continue // 互斥：已記負帳，不再記漏填
    }
    if (day.reported && dv.subtotal === 0) {
      out.push({
        kind: 'revenue_omission', venueId, venueName: venueName(venueId), date: day.date,
        penalty: LEDGER_PENALTY_OMISSION, severity: 'medium',
        title: `${venueName(venueId)} ${day.date} ${LEDGER_ANOMALY_LABEL.revenue_omission}`,
        description: `已勾「回報完畢」但場地費 + 銷售皆為 0，疑似漏填營收，罰 $${LEDGER_PENALTY_OMISSION}`,
        linkId: `${venueId}:${day.date}`,
      })
    }
  }

  // 每月一筆：匯款 / 場地費記帳與系統不符
  if (days.length > 0) {
    const recon = getLedgerReconciliation(venueId, month)
    const diff = recon.totals.court.diff
    if (diff !== null && diff !== 0) {
      const less = diff < 0
      out.push({
        kind: 'deposit_mismatch', venueId, venueName: venueName(venueId),
        penalty: LEDGER_PENALTY_DEPOSIT,
        severity: Math.abs(diff) >= 10000 ? 'high' : 'medium',
        title: `${venueName(venueId)} 本月場地費記帳${less ? '少報' : '多報'}（${LEDGER_ANOMALY_LABEL.deposit_mismatch}）`,
        description: `館長記帳場地費 $${recon.totals.court.ledger.toLocaleString()} vs 系統 $${(recon.totals.court.system ?? 0).toLocaleString()}，差 $${Math.abs(diff).toLocaleString()}，罰 $${LEDGER_PENALTY_DEPOSIT}`,
        linkId: `${venueId}:${month}`,
      })
    }
  }

  return out
}

/** 多館彙總（給對帳首頁 / 異常清單用） */
export function getLedgerAnomalies(venueIds: string[], month: string): LedgerAnomalyRow[] {
  return venueIds.flatMap(id => detectLedgerAnomalies(id, month))
}

/** 某館某月記帳罰款合計 */
export function getLedgerPenaltyTotal(venueId: string, month: string): number {
  return detectLedgerAnomalies(venueId, month).reduce((s, a) => s + a.penalty, 0)
}
