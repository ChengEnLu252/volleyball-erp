// ================================================================
// Demo 假資料 — 直接對應 TypeScript 型別
// Demo 時：從這裡 import
// 正式系統：把 import 換成 API call，component 不需要改
// ================================================================

import type {
  Venue, User, Customer, Session, Registration, Payment,
  Product, ProductTransaction, AnomalyAlert,
  VenueDailySummary, DashboardData, UnpaidItem, WeeklyRevenuePoint,
} from "@/types"

// ── 球館 ──────────────────────────────────────────────────────────

export const MOCK_VENUES: Venue[] = [
  { id:"v1", name:"球魔方", address:"台北市信義區XX路1號", phone:"02-2345-0001", isActive:true, createdAt:new Date("2022-01-01") },
  { id:"v2", name:"Ace",   address:"台北市大安區XX路2號", phone:"02-2345-0002", isActive:true, createdAt:new Date("2022-03-15") },
  { id:"v3", name:"飛翼",  address:"台北市中山區XX路3號", phone:"02-2345-0003", isActive:true, createdAt:new Date("2022-06-01") },
  { id:"v4", name:"日日",  address:"新北市板橋區XX路4號", phone:"02-2345-0004", isActive:true, createdAt:new Date("2023-01-10") },
  { id:"v5", name:"Playone",address:"新北市新莊區XX路5號",phone:"02-2345-0005", isActive:true, createdAt:new Date("2023-04-01") },
  { id:"v6", name:"本館",  address:"台北市松山區XX路6號", phone:"02-2345-0006", isActive:true, createdAt:new Date("2023-08-01") },
]

// ── 使用者（操作人員）──────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  { id:"u1", name:"林老闆",  email:"boss@vb.com",     globalRole:"owner", isActive:true, createdAt:new Date("2022-01-01") },
  { id:"u2", name:"陳館主",  email:"chen@vb.com",     globalRole:"staff", isActive:true, createdAt:new Date("2022-01-05") },
  { id:"u3", name:"李館主",  email:"lee@vb.com",      globalRole:"staff", isActive:true, createdAt:new Date("2022-03-15") },
  { id:"u4", name:"小美（工讀）",email:"mei@vb.com",   globalRole:"staff", isActive:true, createdAt:new Date("2024-01-01") },
  { id:"u5", name:"阿明（工讀）",email:"ming@vb.com",  globalRole:"staff", isActive:true, createdAt:new Date("2024-03-01") },
]

// ── 客戶 ──────────────────────────────────────────────────────────

export const MOCK_CUSTOMERS: Customer[] = [
  { id:"c1",  name:"陳小明", phone:"0912-345-001", skillLevel:"intermediate", preferredNetHeight:"男網",  isBanned:false, createdAt:new Date("2022-05-01"), totalSessions:48 },
  { id:"c2",  name:"李美玲", phone:"0912-345-002", skillLevel:"beginner",     preferredNetHeight:"女網",  isBanned:false, createdAt:new Date("2023-01-15"), totalSessions:12 },
  { id:"c3",  name:"王志豪", phone:"0912-345-003", skillLevel:"advanced",     preferredNetHeight:"男網",  isBanned:false, createdAt:new Date("2022-08-20"), totalSessions:87 },
  { id:"c4",  name:"張雅婷", phone:"0912-345-004", skillLevel:"elementary",   preferredNetHeight:"女網",  isBanned:false, createdAt:new Date("2023-06-01"), totalSessions:24 },
  { id:"c5",  name:"劉建宏", phone:"0912-345-005", skillLevel:"intermediate", preferredNetHeight:"混合",  isBanned:false, createdAt:new Date("2022-11-10"), totalSessions:56 },
  { id:"c6",  name:"黃淑芬", phone:"0912-345-006", skillLevel:"expert",       preferredNetHeight:"男網",  isBanned:false, createdAt:new Date("2022-03-05"), totalSessions:132 },
  { id:"c7",  name:"吳俊賢", phone:"0912-345-007", skillLevel:"intermediate", preferredNetHeight:"可調",  isBanned:false, createdAt:new Date("2023-02-28"), totalSessions:33 },
  { id:"c8",  name:"鄭雨蓁", phone:"0912-345-008", skillLevel:"beginner",     preferredNetHeight:"女網",  isBanned:false, createdAt:new Date("2024-01-05"), totalSessions:6  },
]

// ── 今日場次 ──────────────────────────────────────────────────────

export const MOCK_SESSIONS: Session[] = [
  {
    id:"s1", venueId:"v1", createdBy:"u2",
    sessionDate:new Date(), startTime:"09:00", endTime:"11:00",
    court:"A場", netHeight:"混合", sessionType:"intermediate",
    price:350, maxCapacity:12, minSkillRequired:"elementary",
    status:"open", createdAt:new Date(), updatedAt:new Date(),
    registeredCount:10, paidCount:8, totalRevenue:2800,
  },
  {
    id:"s2", venueId:"v1", createdBy:"u2",
    sessionDate:new Date(), startTime:"14:00", endTime:"16:00",
    court:"B場", netHeight:"女網", sessionType:"beginner",
    price:250, maxCapacity:16, status:"open",
    createdAt:new Date(), updatedAt:new Date(),
    registeredCount:14, paidCount:13, totalRevenue:3250,
  },
  {
    id:"s3", venueId:"v3", createdBy:"u3",
    sessionDate:new Date(), startTime:"09:00", endTime:"11:00",
    court:"主場", netHeight:"男網", sessionType:"mixed",
    price:350, maxCapacity:12, status:"open",
    createdAt:new Date(), updatedAt:new Date(),
    registeredCount:12, paidCount:7, totalRevenue:2450,
  },
  {
    id:"s4", venueId:"v4", createdBy:"u2",
    sessionDate:new Date(), startTime:"10:30", endTime:"12:30",
    court:"A場", netHeight:"女網", sessionType:"intermediate",
    price:300, maxCapacity:12, minSkillRequired:"elementary",
    status:"full", createdAt:new Date(), updatedAt:new Date(),
    registeredCount:12, paidCount:10, totalRevenue:3000,
  },
]

// ── 未付款名單 ─────────────────────────────────────────────────────

export const MOCK_UNPAID: UnpaidItem[] = [
  { registrationId:"r1", customerName:"陳小明", venueName:"飛翼",   sessionLabel:"09:00 混合場", amount:350, registeredAt:new Date(Date.now()-2*3600000) },
  { registrationId:"r2", customerName:"李美玲", venueName:"本館",   sessionLabel:"10:30 女網場", amount:280, registeredAt:new Date(Date.now()-3*3600000) },
  { registrationId:"r3", customerName:"王志豪", venueName:"飛翼",   sessionLabel:"09:00 混合場", amount:350, registeredAt:new Date(Date.now()-3*3600000) },
  { registrationId:"r4", customerName:"張雅婷", venueName:"球魔方", sessionLabel:"14:00 新手場", amount:250, registeredAt:new Date(Date.now()-4*3600000) },
  { registrationId:"r5", customerName:"劉建宏", venueName:"本館",   sessionLabel:"10:30 女網場", amount:280, registeredAt:new Date(Date.now()-5*3600000) },
]

// ── 異常警報 ──────────────────────────────────────────────────────

export const MOCK_ALERTS: AnomalyAlert[] = [
  { id:"a1", venueId:"v3", type:"gift_ratio",       level:"high",   message:"本週商品贈送比例達 38%，超過警戒閾值 20%",   isRead:false, createdAt:new Date() },
  { id:"a2", venueId:"v6", type:"revenue_drop",     level:"high",   message:"今日收入較上週同期低 40%，請確認場次狀況",   isRead:false, createdAt:new Date() },
  { id:"a3", venueId:"v2", type:"low_stock",        level:"medium", message:"護腕庫存僅剩 2 個，低於補貨閾值 5 個",       isRead:false, createdAt:new Date() },
]

// ── 本週收入趨勢 ───────────────────────────────────────────────────

export const MOCK_WEEKLY_REVENUE: WeeklyRevenuePoint[] = [
  { date:new Date(), dayLabel:"週一", revenue:18200 },
  { date:new Date(), dayLabel:"週二", revenue:22400 },
  { date:new Date(), dayLabel:"週三", revenue:19800 },
  { date:new Date(), dayLabel:"週四", revenue:25600 },
  { date:new Date(), dayLabel:"週五", revenue:31200 },
  { date:new Date(), dayLabel:"週六", revenue:42800 },
  { date:new Date(), dayLabel:"週日", revenue:38400 },
]

// ── 各館今日摘要 ───────────────────────────────────────────────────

export const MOCK_VENUE_SUMMARIES: VenueDailySummary[] = [
  { venue:MOCK_VENUES[0], date:new Date(), totalRevenue:8400,  registered:24, capacity:28, unpaidCount:3, sessionCount:3, fillRate:86, hasAlert:false },
  { venue:MOCK_VENUES[1], date:new Date(), totalRevenue:6300,  registered:18, capacity:20, unpaidCount:1, sessionCount:2, fillRate:90, hasAlert:false },
  { venue:MOCK_VENUES[2], date:new Date(), totalRevenue:5250,  registered:15, capacity:24, unpaidCount:5, sessionCount:2, fillRate:63, hasAlert:true  },
  { venue:MOCK_VENUES[3], date:new Date(), totalRevenue:7700,  registered:22, capacity:24, unpaidCount:2, sessionCount:3, fillRate:92, hasAlert:false },
  { venue:MOCK_VENUES[4], date:new Date(), totalRevenue:4200,  registered:12, capacity:20, unpaidCount:0, sessionCount:2, fillRate:60, hasAlert:false },
  { venue:MOCK_VENUES[5], date:new Date(), totalRevenue:3500,  registered:10, capacity:16, unpaidCount:4, sessionCount:1, fillRate:63, hasAlert:true  },
]

// ── Dashboard 聚合資料（demo 直接用這個）────────────────────────────

export const MOCK_DASHBOARD: DashboardData = {
  date:            new Date(),
  totalRevenue:    MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.totalRevenue,0),
  totalRegistered: MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.registered,0),
  totalCapacity:   MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.capacity,0),
  totalUnpaid:     MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.unpaidCount,0),
  alertCount:      MOCK_ALERTS.length,
  venues:          MOCK_VENUE_SUMMARIES,
  recentUnpaid:    MOCK_UNPAID,
  alerts:          MOCK_ALERTS,
  weeklyRevenue:   MOCK_WEEKLY_REVENUE,
}

// ── 商品 ──────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: Product[] = [
  { id:"p1", name:"護腕",     unitPrice:150, currentStock:2,  lowStockThreshold:5,  isActive:true, createdAt:new Date() },
  { id:"p2", name:"護膝",     unitPrice:280, currentStock:12, lowStockThreshold:5,  isActive:true, createdAt:new Date() },
  { id:"p3", name:"排球",     unitPrice:600, currentStock:8,  lowStockThreshold:3,  isActive:true, createdAt:new Date() },
  { id:"p4", name:"運動飲料", unitPrice:45,  currentStock:48, lowStockThreshold:20, isActive:true, createdAt:new Date() },
  { id:"p5", name:"毛巾",     unitPrice:80,  currentStock:25, lowStockThreshold:10, isActive:true, createdAt:new Date() },
]

export const MOCK_PRODUCT_TRANSACTIONS: ProductTransaction[] = [
  { id:"pt1", productId:"p1", venueId:"v2", operatedBy:"u4", type:"sale",   quantity:-1, unitPrice:150, totalAmount:150, customerId:"c3", operatedAt:new Date(Date.now()-1*3600000) },
  { id:"pt2", productId:"p4", venueId:"v3", operatedBy:"u5", type:"gift",   quantity:-3, customerId:"c1", operatedAt:new Date(Date.now()-2*3600000), notes:"訓練後贈送" },
  { id:"pt3", productId:"p5", venueId:"v3", operatedBy:"u5", type:"gift",   quantity:-5, operatedAt:new Date(Date.now()-3*3600000), notes:"活動用" },
  { id:"pt4", productId:"p3", venueId:"v1", operatedBy:"u2", type:"sale",   quantity:-1, unitPrice:600, totalAmount:600, customerId:"c6", operatedAt:new Date(Date.now()-5*3600000) },
  { id:"pt5", productId:"p2", venueId:"v4", operatedBy:"u4", type:"sale",   quantity:-2, unitPrice:280, totalAmount:560, customerId:"c7", operatedAt:new Date(Date.now()-6*3600000) },
]
