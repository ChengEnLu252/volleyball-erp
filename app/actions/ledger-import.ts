'use server'

// ============================================================
// app/actions/ledger-import.ts — 月記帳 Excel 匯入（P2.5 藍本）
// ------------------------------------------------------------
// 把對方「多爾森健康」各館月記帳 Excel（時段×日期矩陣，7 館格式相同）
// 解析成 LedgerDay 記錄 → 預覽 → 確認後 upsert 進 ledger_days。
// 解析邏輯移植自 client-data/parse_ledger.py（同樣的列/欄座標）。
//
// 流程：parseLedgerExcelAction(FormData) → 預覽（不寫）；
//       importLedgerDaysAction({venueId, days}) → upsert + AuditLog。
// 授權：owner / manager + venue 在 scope。
// ============================================================

import ExcelJS from 'exceljs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getVenuesForUserAsync, type UserScope } from '@/data/server/queries'
import { LEDGER_SLOTS } from '@/data/ledger-core'
import type { LedgerSlotValue } from '@/types'

// ── Excel 座標（1-indexed，對齊 parse_ledger.py）─────────────────
const SLOT_ROW_FROM = 5, SLOT_ROW_TO = 21        // 時段列（col A=標籤，值=該日該時段場地費）
const ROW = { merch: 22, snacks: 23, drinks: 24, acFee: 25, other: 26, seasonFee: 28, privatePrepay: 29, refund: 31 }
const R_DATE = 38, R_DEG = 44, R_DONE = 36       // 右側彙總：日期/冷氣度數/回報完畢 所在「欄」
const DATE_HEADER_ROW = 3, DATE_COL_FROM = 3, DATE_COL_TO = 33

const WD = ['一', '二', '三', '四', '五', '六', '日']

// 時段標籤正規化（"08-09"/"9~10"/"24-01" → 比對我們的 LEDGER_SLOTS key）
function normSlot(s: string): string {
  return s.replace(/[～~]/g, '-').replace(/\s/g, '').split('-').map((x) => { const n = parseInt(x, 10); return Number.isFinite(n) ? String(n) : x }).join('-')
}
const SLOT_KEY_BY_NORM = new Map<string, string>(LEDGER_SLOTS.map((s) => [normSlot(s.key), s.key]))

function cellNum(v: ExcelJS.CellValue): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in v && typeof (v as any).result === 'number') return (v as any).result
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
function cellDate(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (v && typeof v === 'object' && 'result' in v && (v as any).result instanceof Date) return (v as any).result.toISOString().slice(0, 10)
  return null
}
function cellBool(v: ExcelJS.CellValue): boolean {
  if (v === true) return true
  if (v && typeof v === 'object' && 'result' in v) return (v as any).result === true || String((v as any).result).toUpperCase() === 'TRUE'
  const s = String(v ?? '').trim().toUpperCase()
  return s === 'TRUE' || s === '是' || s === 'V' || s === '✓'
}

export type ParsedLedgerDay = {
  date: string; month: string; weekday: string
  slots: Record<string, number>
  merch: number; snacks: number; drinks: number; ac: number; other: number
  seasonFee: number; privatePrepay: number; acFee: number; refund: number
  acDegrees: number; reported: boolean
  courtTotal: number // 預覽用：場地費加總
}

export type ParseResult =
  | { ok: true; months: string[]; days: ParsedLedgerDay[]; unmatchedSlots: string[] }
  | { ok: false; error: string }

/** 解析上傳的月記帳 Excel → 預覽（不寫 DB）。 */
export async function parseLedgerExcelAction(formData: FormData): Promise<ParseResult> {
  const me = await getSessionUser()
  if (!me) return { ok: false, error: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, error: '無權限匯入（限館長／老闆）' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: '請選擇 Excel 檔' }
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: '檔案過大（上限 8MB）' }

  let wb: ExcelJS.Workbook
  try {
    wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    return { ok: false, error: '無法讀取 Excel（請確認是 .xlsx）' }
  }

  const monthSheets = wb.worksheets.filter((ws) => /^20\d{4}$/.test(ws.name))
  if (monthSheets.length === 0) return { ok: false, error: '找不到月分頁（需命名為 YYYYMM，如 202601）' }

  const days: ParsedLedgerDay[] = []
  const unmatched = new Set<string>()

  for (const ws of monthSheets) {
    const month = ws.name.slice(0, 4) + '-' + ws.name.slice(4, 6)
    // 日期欄（row3, col3..33）
    const dateCols: Array<{ date: string; col: number }> = []
    for (let c = DATE_COL_FROM; c <= DATE_COL_TO; c++) {
      const d = cellDate(ws.getCell(DATE_HEADER_ROW, c).value)
      if (d) dateCols.push({ date: d, col: c })
    }
    // 右側彙總（依日期對應 度數/回報）
    const right = new Map<string, { acDegrees: number; reported: boolean }>()
    for (let r = 5; r <= 39; r++) {
      const d = cellDate(ws.getCell(r, R_DATE).value)
      if (d) right.set(d, { acDegrees: cellNum(ws.getCell(r, R_DEG).value), reported: cellBool(ws.getCell(r, R_DONE).value) })
    }

    for (const { date, col } of dateCols) {
      const slots: Record<string, number> = {}
      let courtTotal = 0
      for (let r = SLOT_ROW_FROM; r <= SLOT_ROW_TO; r++) {
        const label = String(ws.getCell(r, 1).value ?? '').trim()
        if (!label) continue
        const v = cellNum(ws.getCell(r, col).value)
        if (!v) continue
        const key = SLOT_KEY_BY_NORM.get(normSlot(label))
        if (key) { slots[key] = v; courtTotal += v } else { unmatched.add(label) }
      }
      const rb = right.get(date) ?? { acDegrees: 0, reported: false }
      const wd = WD[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7]
      days.push({
        date, month, weekday: wd, slots,
        merch: cellNum(ws.getCell(ROW.merch, col).value), snacks: cellNum(ws.getCell(ROW.snacks, col).value),
        drinks: cellNum(ws.getCell(ROW.drinks, col).value), ac: 0, other: cellNum(ws.getCell(ROW.other, col).value),
        seasonFee: cellNum(ws.getCell(ROW.seasonFee, col).value), privatePrepay: cellNum(ws.getCell(ROW.privatePrepay, col).value),
        acFee: cellNum(ws.getCell(ROW.acFee, col).value), refund: cellNum(ws.getCell(ROW.refund, col).value),
        acDegrees: rb.acDegrees, reported: rb.reported, courtTotal,
      })
    }
  }

  days.sort((a, b) => a.date.localeCompare(b.date))
  return { ok: true, months: monthSheets.map((w) => w.name), days, unmatchedSlots: [...unmatched] }
}

// ── 確認匯入 ───────────────────────────────────────────────────
const int = (n: unknown): number => { const v = Math.round(Number(n)); return Number.isFinite(v) ? v : 0 }
function venueAllowed(scope: UserScope, venueId: string): boolean {
  return scope.visibleVenueIds === 'all' || scope.visibleVenueIds.includes(venueId)
}

export async function importLedgerDaysAction(input: { venueId: string; days: ParsedLedgerDay[] }): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  const me = await getSessionUser()
  if (!me) return { ok: false, error: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, error: '無權限匯入' }
  if (!venueAllowed(scope, input.venueId)) return { ok: false, error: '不可匯入其他球館' }
  if (!Array.isArray(input.days) || input.days.length === 0) return { ok: false, error: '沒有可匯入的資料' }

  let imported = 0
  for (const d of input.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue
    const slots: Record<string, LedgerSlotValue> = {}
    for (const [k, v] of Object.entries(d.slots || {})) if (typeof v === 'number' && Number.isFinite(v)) slots[k] = v
    const data = {
      slots: slots as unknown as Prisma.InputJsonValue,
      merch: int(d.merch), snacks: int(d.snacks), drinks: int(d.drinks), ac: int(d.ac), other: int(d.other),
      seasonFee: int(d.seasonFee), privatePrepay: int(d.privatePrepay), acFee: int(d.acFee), refund: int(d.refund),
      acDegrees: int(d.acDegrees), bookingNote: '', refundNote: '', merchNote: '', reported: !!d.reported,
      updatedBy: scope.userId,
    }
    await prisma.ledgerDay.upsert({
      where: { venueId_date: { venueId: input.venueId, date: new Date(d.date) } },
      create: { venueId: input.venueId, date: new Date(d.date), ...data },
      update: data,
    })
    imported++
  }

  await prisma.auditLog.create({
    data: { userId: scope.userId, action: 'UPSERT_LEDGER', entityType: 'LedgerDayImport', entityId: input.venueId, newValues: { venueId: input.venueId, imported } },
  })
  return { ok: true, imported }
}

/** 匯入頁可見球館（owner/manager） */
export async function getImportVenuesAction(): Promise<{ id: string; name: string }[]> {
  const me = await getSessionUser()
  if (!me) return []
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return []
  return (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
}
