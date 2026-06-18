// ============================================================
// prisma/seed.ts — 資料庫種子
// ------------------------------------------------------------
// 執行：npm run db:seed  （= prisma db seed = tsx prisma/seed.ts）
//
// 🔑 設計：直接「重用」既有的 data/generator.ts（Mulberry32 seed=42）
//    產生的資料，map 進 Prisma。好處：
//      - 不手抄、與 demo 既有故事點完全一致（飛翼贈送偏高、球魔方營收驟降…）
//      - dashboard/場次/季租 等頁遷到真 DB 後，數字與 demo 對得起來
//
// ⚠️ TODO[簽約後填真]：以下全部是「測試資料」。簽約後對方提供真實資料時，
//    只需替換 data 來源（改成讀對方的 Excel/CSV 匯入），重跑此 seed 即可，
//    不必動任何頁面或 API。各區塊對應要跟對方索取的清單見 INFO-REQUEST.md：
//      - venues           → INFO-REQUEST.md §A（場館基本資料）
//      - users / 角色 / 密碼 → INFO-REQUEST.md §B（組織與帳號）
//      - timeslots / seasons → INFO-REQUEST.md §C（時段與場次）
//      - customers        → INFO-REQUEST.md §D（客戶名單，含個資）
//      - 球費 / 冷氣費 / 季租價 → INFO-REQUEST.md §E（收費）
//
// ⚠️ 決定性注意：generator 以「今天」為錨點計算所有相對日期（含 season 區間、
//    captain token 到期、場次日期）。因此「在不同日期重跑 seed」會讓整個時間
//    視窗平移——這在開發階段是預期行為（每天 demo 都新鮮）。正式上線前會改成
//    用對方提供的真實日期，不再相對於今天。
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { GENERATED } from '../data/generator'

// 大量 seed 走 direct/session 連線（DIRECT_URL），不走 transaction pooler——
// pgbouncer transaction mode 對長時間多批寫入容易逾時/斷線。
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
})

// ── helpers ──────────────────────────────────────────────────

/** SkillLevel：generator 用原始字串（B+/A+/S*），但 Prisma enum 用 schema 名稱 */
const SKILL_MAP: Record<string, string> = { 'B+': 'B_PLUS', 'A+': 'A_PLUS', 'S*': 'S_STAR' }
const skill = (s: string | null | undefined): string | null =>
  s == null ? null : (SKILL_MAP[s] ?? s)

/** 字串/ISO → Date（Prisma DateTime / @db.Date 欄位用） */
const dt = (v: string | null | undefined): Date | null => (v == null ? null : new Date(v))

/** 大量資料分批 createMany，避免單一 INSERT 超過 Postgres 65535 bind-param 上限 */
async function insertChunked<T>(
  label: string,
  rows: readonly T[],
  fn: (chunk: T[]) => Promise<unknown>,
  // 2000 列/批：最寬的 table（session ~21 欄）× 2000 仍遠低於 Postgres
  // 65535 bind-param 上限，同時把網路往返次數降到約 1/2。
  size = 2000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size))
  }
  console.log(`  ✓ ${label}: ${rows.length}`)
}

// ── UserVenueRole 種子（來源：data/permissions.ts，刻意內聯避免拉進前端模組）──
// TODO[簽約後填真]：依 INFO-REQUEST.md §B2/§B3 換成真實館長/工讀生對應
const USER_VENUE_ROLES = [
  { userId: 'u2', venueId: 'v3', role: 'manager' }, // 王館主 → 飛翼
  { userId: 'u3', venueId: 'v1', role: 'manager' }, // 李小芳 → 球魔方 2.0
  { userId: 'u4', venueId: 'v3', role: 'staff' },   // 工讀生小明 → 飛翼
] as const

async function main() {
  console.log('🌱 seeding（測試資料；簽約後替換來源即可）...')

  // ── 1. 清空（反向 FK 順序，確保可重複執行）──────────────────
  console.log('清空既有資料...')
  await prisma.auditLog.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.registration.deleteMany()
  await prisma.productTransaction.deleteMany()
  await prisma.anomalyAlert.deleteMany()
  await prisma.session.deleteMany()
  await prisma.seasonRental.deleteMany()
  await prisma.timeslot.deleteMany()
  await prisma.season.deleteMany()
  await prisma.product.deleteMany()
  await prisma.userVenueRole.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
  await prisma.venue.deleteMany()

  // ── 2. 插入（正向 FK 順序）──────────────────────────────────
  console.log('插入資料...')

  // §A 場館
  await insertChunked('venues', GENERATED.venues, (c) =>
    prisma.venue.createMany({
      data: c.map((v) => ({
        id: v.id, name: v.name, address: v.address, phone: v.phone,
        isActive: v.isActive, createdAt: dt(v.createdAt)!,
      })),
    }),
  )

  // §B 使用者（密碼一律 bcrypt("0000") 對齊 demo；簽約後改強制改密）
  const passwordHash = await bcrypt.hash('0000', 10)
  await insertChunked('users', GENERATED.users, (c) =>
    prisma.user.createMany({
      data: c.map((u) => ({
        id: u.id, name: u.name, email: u.email,
        // 登入代號＝email 前綴（boss/wang/fang/ming），好記、可空 unique
        // TODO[簽約後填真]：依 INFO-REQUEST.md §B 換成對方指定的登入代號
        username: u.email.split('@')[0],
        phone: u.phone,
        passwordHash, globalRole: u.globalRole, isActive: u.isActive,
        createdAt: dt(u.createdAt)!,
      })),
    }),
  )

  // §B 使用者×球館角色
  await insertChunked('userVenueRoles', USER_VENUE_ROLES, (c) =>
    prisma.userVenueRole.createMany({ data: c.map((r) => ({ ...r })) }),
  )

  // §D 客戶（phone 在 schema 為 unique → 去重，重複者設 null，不影響 FK 以 id 連）
  const seenPhones = new Set<string>()
  const customerRows = GENERATED.customers.map((cust) => {
    let phone = cust.phone
    if (phone && seenPhones.has(phone)) phone = null
    if (phone) seenPhones.add(phone)
    return {
      id: cust.id, name: cust.name, phone, email: cust.email,
      skillLevel: skill(cust.skillLevel) as never,
      preferredNetHeight: cust.preferredNetHeight,
      notes: cust.notes, isBanned: cust.isBanned, createdAt: dt(cust.createdAt)!,
    }
  })
  await insertChunked('customers', customerRows, (c) => prisma.customer.createMany({ data: c }))

  // §C 季
  await insertChunked('seasons', GENERATED.seasons, (c) =>
    prisma.season.createMany({
      data: c.map((s) => ({
        id: s.id, name: s.name, startDate: dt(s.startDate)!, endDate: dt(s.endDate)!,
        numWeeks: s.numWeeks, isActive: s.isActive, createdAt: dt(s.createdAt)!,
      })),
    }),
  )

  // §C 時段
  await insertChunked('timeslots', GENERATED.timeslots, (c) =>
    prisma.timeslot.createMany({
      data: c.map((t) => ({
        id: t.id, venueId: t.venueId, label: t.label, dayOfWeek: t.dayOfWeek,
        startTime: t.startTime, endTime: t.endTime, court: t.court,
        defaultNetHeight: t.defaultNetHeight, defaultSessionType: t.defaultSessionType,
        defaultMinSkillRequired: skill(t.defaultMinSkillRequired) as never,
        defaultMaxSkillAllowed: skill(t.defaultMaxSkillAllowed) as never,
        defaultMaxCapacity: t.defaultMaxCapacity, defaultCourtFee: t.defaultCourtFee,
        isHotZone: t.isHotZone, isActive: t.isActive,
        createdAt: dt(t.createdAt)!, updatedAt: dt(t.updatedAt)!,
      })),
    }),
  )

  // 商品（p1–p4；venueProducts 是顯示用 shape，不入庫）
  await insertChunked('products', GENERATED.products, (c) =>
    prisma.product.createMany({
      data: c.map((p) => ({
        id: p.id, venueId: p.venueId, name: p.name, sku: p.sku, unitPrice: p.unitPrice,
        currentStock: p.currentStock, lowStockThreshold: p.lowStockThreshold,
        isActive: p.isActive, createdAt: dt(p.createdAt)!,
      })),
    }),
  )

  // §E 季租單
  await insertChunked('seasonRentals', GENERATED.seasonRentals, (c) =>
    prisma.seasonRental.createMany({
      data: c.map((r) => ({
        id: r.id, timeslotId: r.timeslotId, seasonId: r.seasonId, captainId: r.captainId,
        pricePerSession: r.pricePerSession, totalAmount: r.totalAmount, paidAmount: r.paidAmount,
        accessToken: r.accessToken, accessTokenExpiresAt: dt(r.accessTokenExpiresAt)!,
        status: r.status, notes: r.notes, createdAt: dt(r.createdAt)!, updatedAt: dt(r.updatedAt)!,
      })),
    }),
  )

  // 場次
  await insertChunked('sessions', GENERATED.sessions, (c) =>
    prisma.session.createMany({
      data: c.map((s) => ({
        id: s.id, venueId: s.venueId, timeslotId: s.timeslotId, seasonRentalId: s.seasonRentalId,
        createdBy: s.createdBy, sessionDate: dt(s.sessionDate)!, startTime: s.startTime, endTime: s.endTime,
        court: s.court, netHeight: s.netHeight, sessionType: s.sessionType,
        courtFee: s.courtFee, acFee: s.acFee, acEnabled: s.acEnabled, maxCapacity: s.maxCapacity,
        minSkillRequired: skill(s.minSkillRequired) as never,
        maxSkillAllowed: skill(s.maxSkillAllowed) as never,
        status: s.status, isUnattended: s.isUnattended, notes: s.notes,
        createdAt: dt(s.createdAt)!, updatedAt: dt(s.updatedAt)!,
      })),
    }),
  )

  // 報名（僅取 schema 欄位，省略衍生欄位與 refundDecision）
  await insertChunked('registrations', GENERATED.registrations, (c) =>
    prisma.registration.createMany({
      data: c.map((r) => ({
        id: r.id, sessionId: r.sessionId, customerId: r.customerId, type: r.type,
        registeredBy: r.registeredBy, registeredBySource: r.registeredBySource,
        status: r.status, notes: r.notes, registeredAt: dt(r.registeredAt)!,
        selfReportedPaid: r.selfReportedPaid, selfPaymentMethod: r.selfPaymentMethod,
        selfPaymentEvidence: r.selfPaymentEvidence, selfReportedAt: dt(r.selfReportedAt),
      })),
    }),
  )

  // 付款
  await insertChunked('payments', GENERATED.payments, (c) =>
    prisma.payment.createMany({
      data: c.map((p) => ({
        id: p.id, registrationId: p.registrationId, recordedBy: p.recordedBy,
        amount: p.amount, method: p.method, status: p.status, notes: p.notes,
        paidAt: dt(p.paidAt)!,
      })),
    }),
  )

  // 商品交易
  await insertChunked('productTransactions', GENERATED.productTransactions, (c) =>
    prisma.productTransaction.createMany({
      data: c.map((t) => ({
        id: t.id, productId: t.productId, venueId: t.venueId, operatedBy: t.operatedBy,
        type: t.type, quantity: t.quantity, unitPrice: t.unitPrice, totalAmount: t.totalAmount,
        customerId: t.customerId, sessionId: t.sessionId, notes: t.notes, operatedAt: dt(t.operatedAt)!,
      })),
    }),
  )

  // 異常警報
  await insertChunked('anomalyAlerts', GENERATED.alerts, (c) =>
    prisma.anomalyAlert.createMany({
      data: c.map((a) => ({
        id: a.id, venueId: a.venueId, type: a.type, severity: a.severity,
        message: a.message, isRead: a.isRead, createdAt: dt(a.createdAt)!,
      })),
    }),
  )

  console.log('✅ seed 完成')
}

main()
  .catch((e) => {
    console.error('❌ seed 失敗:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
