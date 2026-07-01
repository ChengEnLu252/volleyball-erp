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

import { readFileSync } from 'node:fs'
import { PrismaClient, Prisma } from '@prisma/client'
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
  await prisma.lineNotification.deleteMany()
  await prisma.customerViolation.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.shopProductCategory.deleteMany()
  await prisma.shopProductImage.deleteMany()
  await prisma.shopProductVariant.deleteMany()
  await prisma.shopProduct.deleteMany()
  await prisma.shopCategory.deleteMany()
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
        // 既有種子帳號（含 owner）一律視為已審核
        approvalStatus: 'approved',
        createdAt: dt(u.createdAt)!,
      })),
    }),
  )

  // §B 使用者×球館角色
  await insertChunked('userVenueRoles', USER_VENUE_ROLES, (c) =>
    prisma.userVenueRole.createMany({ data: c.map((r) => ({ ...r })) }),
  )

  // §D 客戶（phone 不再 unique → 不去重；gender 種子未提供，預設 null）
  // 四項自評（攻擊/防守/舉球/攔網）：由既有單一程度確定性擴散生成（假資料，
  // 讓平均/區間顯示有東西可看）；skillLevel 改存四項平均。真資料以報名寫入為準。
  const SKILL_ORDER = ['E', 'D', 'C', 'B', 'B+', 'A', 'A+', 'S', 'S*']
  const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
  const clampIdx = (n: number) => Math.max(0, Math.min(8, n))
  function fourSkills(base: string | null, id: string): { four: (string | null)[]; avg: string | null } {
    if (!base || SKILL_ORDER.indexOf(base) < 0) return { four: [null, null, null, null], avg: base }
    const bi = SKILL_ORDER.indexOf(base)
    const h = hashStr(id)
    const idx = [0, 2, 4, 6].map((sh) => clampIdx(bi + (((h >> sh) & 3) - 1))) // 每項 -1~+2
    const avg = SKILL_ORDER[Math.round(idx.reduce((a, b) => a + b, 0) / 4)]
    return { four: idx.map((i) => SKILL_ORDER[i]), avg }
  }
  const customerRows = GENERATED.customers.map((cust) => {
    const { four, avg } = fourSkills(cust.skillLevel, cust.id)
    return {
      id: cust.id, name: cust.name, phone: cust.phone, email: cust.email,
      skillLevel: skill(avg) as never,
      skillAttack: skill(four[0]) as never, skillDefense: skill(four[1]) as never,
      skillSetting: skill(four[2]) as never, skillBlock: skill(four[3]) as never,
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

  // ── §S 線上商城（SC1）──────────────────────────────────────
  // 🟢 商品 = 對方 lineaone.cyberbiz.co 的「真」商品目錄（49 項），
  //    由官方 /products/<handle>.json 抓下（見 prisma/seed-data/lineaone-catalog.json）。
  //    圖片先用 Cyberbiz CDN 簽名網址；正式脫離 Cyberbiz 前批次下載自存（收尾）。
  // ⚠️ TODO[簽約後校對]：庫存數字/上下架以對方後台為準；重抓 catalog 覆蓋即可。
  type CatalogItem = {
    handle: string; sourceId: number; title: string; unitPrice: number
    compareAtPrice: number | null; available: boolean
    sizes: string[]; colors: { name: string; hex: string }[]
    variants: { size: string | null; color: string | null; stock: number; sku: string | null; price: number; compareAtPrice: number | null }[]
    onlineStock: number; images: string[]; description: string; firstSku: string | null
  }
  const catalog: CatalogItem[] = JSON.parse(
    readFileSync(new URL('./seed-data/lineaone-catalog.json', import.meta.url), 'utf8'),
  )

  // 分類 = 依真實商品組成（多對多；一個商品可屬多類）
  const SHOP_CATEGORIES = [
    { id: 'cat_promo',      name: '限時團購優惠', slug: 'promo',      sortOrder: 0 },
    { id: 'cat_volleyball', name: '排球',         slug: 'volleyball', sortOrder: 1 },
    { id: 'cat_basketball', name: '籃球',         slug: 'basketball', sortOrder: 2 },
    { id: 'cat_pickleball', name: '匹克球',       slug: 'pickleball', sortOrder: 3 },
    { id: 'cat_apparel',    name: '服飾／聯名',   slug: 'apparel',    sortOrder: 4 },
    { id: 'cat_accessory',  name: '配件／器材',   slug: 'accessory',  sortOrder: 5 },
    { id: 'cat_conti',      name: 'Conti 專區',   slug: 'conti',      sortOrder: 6 },
  ]
  await prisma.shopCategory.createMany({ data: SHOP_CATEGORIES })
  console.log(`  ✓ shopCategories: ${SHOP_CATEGORIES.length}`)

  // 依商品名稱關鍵字歸類（真實 taxonomy）
  const classify = (name: string): string[] => {
    const cats: string[] = []
    if (/團購|限時|專屬/.test(name)) cats.push('cat_promo')
    if (/匹克/.test(name)) cats.push('cat_pickleball')
    else if (/籃球/.test(name)) cats.push('cat_basketball')
    else if (/排球|沙灘|MIKASA|Pro Touch|V[45][MBC]?\d|合成皮|橡膠排球|旋風/i.test(name)) cats.push('cat_volleyball')
    if (/T-?shirt|小狗|小貓|貓生|Volleymates|圖鑑|排咖|白帶|襪/i.test(name)) cats.push('cat_apparel')
    if (/Conti/i.test(name)) cats.push('cat_conti')
    // 器材/配件：球車/記分/球網/護膝/打氣/教練板/戰術板/鑰匙圈/零錢包/鞋帶/白貼/標示/球拍套組
    if (/球車|記分|球網|護膝|打氣|教練板|戰術板|鑰匙圈|零錢包|鞋帶|白貼|白tape|標示|拍套組|球拍|球x/i.test(name)) cats.push('cat_accessory')
    if (cats.length === 0) cats.push('cat_accessory') // 兜底
    return [...new Set(cats)]
  }
  const emojiFor = (cats: string[]): string =>
    cats.includes('cat_apparel') ? '👕' : cats.includes('cat_basketball') ? '🏀'
      : cats.includes('cat_pickleball') ? '🥎' : cats.includes('cat_accessory') ? '🎒' : '🏐'

  // 穩定 id：shop_<Cyberbiz sourceId>
  const pid = (it: CatalogItem) => `shop_${it.sourceId}`
  const hasAxes = (it: CatalogItem) => it.sizes.length > 0 || it.colors.length > 0

  await insertChunked('shopProducts', catalog, (c) =>
    prisma.shopProduct.createMany({
      data: c.map((it) => ({
        id: pid(it), name: it.title, unitPrice: it.unitPrice,
        compareAtPrice: it.compareAtPrice,
        onlineStock: it.onlineStock, isListed: it.available,
        description: it.description, emoji: emojiFor(classify(it.title)),
        sizes: it.sizes, colors: it.colors as unknown as Prisma.InputJsonValue,
        sourceProductId: null,
      })),
    }),
  )

  // 規格：只有「有色/尺寸軸」的商品才建 variant 列；單一款商品用 onlineStock。
  // 去重 (shopProductId,size,color)：對方後台偶有重複組合 → 合併庫存、保留首個 SKU。
  const variantMap = new Map<string, { shopProductId: string; size: string | null; color: string | null; stock: number; sku: string | null }>()
  for (const it of catalog.filter(hasAxes)) {
    for (const v of it.variants) {
      const k = `${pid(it)}|${v.size ?? ''}|${v.color ?? ''}`
      const cur = variantMap.get(k)
      if (cur) cur.stock += v.stock
      else variantMap.set(k, { shopProductId: pid(it), size: v.size, color: v.color, stock: v.stock, sku: v.sku })
    }
  }
  const variantRows = [...variantMap.values()]
  await insertChunked('shopProductVariants', variantRows, (c) => prisma.shopProductVariant.createMany({ data: c }))

  const imageRows = catalog.flatMap((it) =>
    it.images.map((url, i) => ({ shopProductId: pid(it), url, sortOrder: i })),
  )
  await insertChunked('shopProductImages', imageRows, (c) => prisma.shopProductImage.createMany({ data: c }))

  const catRows = catalog.flatMap((it) =>
    classify(it.title).map((categoryId) => ({ shopProductId: pid(it), categoryId })),
  )
  await insertChunked('shopProductCategories', catRows, (c) => prisma.shopProductCategory.createMany({ data: c }))

  await insertChunked('orders', GENERATED.orders, (c) =>
    prisma.order.createMany({
      data: c.map((o) => ({
        id: o.id, orderNo: o.orderNo, channel: o.channel,
        customerName: o.customerName, customerPhone: o.customerPhone, customerEmail: o.customerEmail,
        placedByUserId: o.placedByUserId,
        itemTotal: o.itemTotal, shippingFee: o.shippingFee, total: o.total,
        fulfillment: o.fulfillment, pickupVenueId: o.pickupVenueId,
        shipping: (o.shipping ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        paymentChannel: o.paymentChannel, status: o.status, notes: o.notes,
        paidAt: dt(o.paidAt), fulfilledAt: dt(o.fulfilledAt),
        cancelledAt: dt(o.cancelledAt), cancelReason: o.cancelReason,
        createdAt: dt(o.createdAt)!, updatedAt: dt(o.updatedAt)!,
      })),
    }),
  )

  const orderItemRows = GENERATED.orders.flatMap((o) =>
    o.items.map((it) => ({
      orderId: o.id, productId: it.productId, name: it.name, unitPrice: it.unitPrice,
      quantity: it.quantity, subtotal: it.subtotal, size: it.size ?? null, color: it.color ?? null,
    })),
  )
  await insertChunked('orderItems', orderItemRows, (c) => prisma.orderItem.createMany({ data: c }))

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
