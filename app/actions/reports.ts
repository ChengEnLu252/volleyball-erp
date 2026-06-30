'use server'

// ============================================================
// app/actions/reports.ts — 報表匯出（P2.2c2，真 CSV）
// ------------------------------------------------------------
// 取代原本 finance/payments 頁的假匯出（setTimeout 2 秒）。
//   由真 DB 依「報表類型 + 球館 + 日期區間」產出表格 → 轉成 CSV 字串回傳，
//   client 端再用 Blob 觸發下載。
//
// 授權：必須是已登入 ERP 人員（role !== 'none'）；球館篩選在 server 端
//   再交叉 scope（manager/staff 不能匯出他館資料，fail-closed）。
// ============================================================

import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, buildReportTableAsync, type ReportType } from '@/data/server/queries'

const VALID_TYPES: ReportType[] = ['revenue_daily', 'venue_summary', 'payment', 'customer']

export type ExportResult =
  | { ok: true; filename: string; csv: string; rowCount: number }
  | { ok: false; reason: string }

/** 一格值 → CSV 安全字串（含逗號/引號/換行時用引號包起並跳脫雙引號） */
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportReportAction(input: {
  type: ReportType
  venueId: string
  from: string
  to: string
}): Promise<ExportResult> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false, reason: '無權限' }

  if (!VALID_TYPES.includes(input.type)) return { ok: false, reason: '不支援的報表類型' }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(input.from) || !dateRe.test(input.to)) return { ok: false, reason: '日期格式錯誤' }
  if (input.from > input.to) return { ok: false, reason: '開始日期不可晚於結束日期' }

  const table = await buildReportTableAsync(scope, input.type, input.venueId || 'all', input.from, input.to)

  // UTF-8 BOM 讓 Excel 正確辨識繁中
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(','))
  const csv = '﻿' + lines.join('\r\n')

  return { ok: true, filename: table.filename, csv, rowCount: table.rows.length }
}
