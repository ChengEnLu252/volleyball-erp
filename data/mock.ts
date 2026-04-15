import type {
  Venue, User, Customer, Session, Product, ProductTransaction,
  DashboardData, VenueDailySummary, AnomalyAlert, UnpaidRegistration
} from '@/types'

export const MOCK_VENUES: Venue[] = [
  { id: 'v1', name: '球魔方',  address: '台北市大安區復興南路一段', phone: '02-2701-xxxx', isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'v2', name: 'Ace',    address: '台北市信義區松仁路',        phone: '02-2345-xxxx', isActive: true, createdAt: '2022-03-01T00:00:00Z' },
  { id: 'v3', name: '飛翼',   address: '新北市板橋區文化路',        phone: '02-2956-xxxx', isActive: true, createdAt: '2022-06-01T00:00:00Z' },
  { id: 'v4', name: '日日',   address: '台北市中山區中山北路',      phone: '02-2521-xxxx', isActive: true, createdAt: '2023-01-01T00:00:00Z' },
  { id: 'v5', name: 'Playone', address: '台北市松山區八德路',       phone: '02-2748-xxxx', isActive: true, createdAt: '2023-06-01T00:00:00Z' },
]

export const MOCK_USERS: User[] = [
  { id: 'u1', name: '陳老闆',    email: 'boss@volleyball.tw',  phone: '0912-xxx-001', globalRole: 'owner', isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'u2', name: '王館主',    email: 'wang@volleyball.tw',  phone: '0912-xxx-002', globalRole: 'staff', isActive: true, createdAt: '2022-01-15T00:00:00Z' },
  { id: 'u3', name: '李小芳',    email: 'fang@volleyball.tw',  phone: '0912-xxx-003', globalRole: 'staff', isActive: true, createdAt: '2022-02-01T00:00:00Z' },
  { id: 'u4', name: '工讀生小明', email: 'ming@volleyball.tw', phone: '0912-xxx-004', globalRole: 'staff', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
]

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1',  name: '林小明', phone: '0911-111-001', email: null,           skillLevel: 'B',  preferredNetHeight: 'male',       notes: null,     isBanned: false, createdAt: '2022-06-01T00:00:00Z' },
  { id: 'c2',  name: '陳美玲', phone: '0911-111-002', email: 'ml@gmail.com', skillLevel: 'E',  preferredNetHeight: 'female',     notes: '態度好', isBanned: false, createdAt: '2023-01-15T00:00:00Z' },
  { id: 'c3',  name: '王大偉', phone: '0911-111-003', email: null,           skillLevel: 'A',  preferredNetHeight: 'male',       notes: null,     isBanned: false, createdAt: '2022-08-20T00:00:00Z' },
  { id: 'c4',  name: '張志豪', phone: '0911-111-004', email: null,           skillLevel: 'D',  preferredNetHeight: 'adjustable', notes: null,     isBanned: false, createdAt: '2023-03-10T00:00:00Z' },
  { id: 'c5',  name: '劉雅婷', phone: '0911-111-005', email: 'yt@gmail.com', skillLevel: 'B+', preferredNetHeight: 'female',     notes: null,     isBanned: false, createdAt: '2022-11-01T00:00:00Z' },
  { id: 'c6',  name: '吳建宏', phone: '0911-111-006', email: null,           skillLevel: 'S',  preferredNetHeight: 'male',       notes: null,     isBanned: false, createdAt: '2022-05-15T00:00:00Z' },
  { id: 'c7',  name: '黃淑芬', phone: '0911-111-007', email: 'sf@gmail.com', skillLevel: 'B',  preferredNetHeight: 'female',     notes: null,     isBanned: false, createdAt: '2023-06-01T00:00:00Z' },
  { id: 'c8',  name: '楊明哲', phone: '0911-111-008', email: null,           skillLevel: 'A',  preferredNetHeight: 'male',       notes: '前國手', isBanned: false, createdAt: '2022-04-01T00:00:00Z' },
  { id: 'c9',  name: '蔡依玲', phone: '0911-111-009', email: null,           skillLevel: 'E',  preferredNetHeight: 'female',     notes: null,     isBanned: false, createdAt: '2024-01-10T00:00:00Z' },
  { id: 'c10', name: '鄭志明', phone: '0911-111-010', email: 'zm@gmail.com', skillLevel: 'B-', preferredNetHeight: 'adjustable', notes: null,     isBanned: false, createdAt: '2023-09-01T00:00:00Z' },
]

const TODAY = new Date().toISOString().split('T')[0]

export const MOCK_SESSIONS: Session[] = [
  { id: 's1', venueId: 'v1', createdBy: 'u2', sessionDate: TODAY, startTime: '09:00', endTime: '12:00', court: 'A館', netHeight: 'male',       sessionType: 'mixed',        price: 250, maxCapacity: 12, minSkillRequired: null, maxSkillAllowed: null, status: 'completed', notes: null, createdAt: TODAY+'T00:00:00Z', updatedAt: TODAY+'T00:00:00Z', venueName: '球魔方', currentCount: 10 },
  { id: 's2', venueId: 'v1', createdBy: 'u2', sessionDate: TODAY, startTime: '14:00', endTime: '17:00', court: 'A館', netHeight: 'female',     sessionType: 'beginner',     price: 200, maxCapacity: 12, minSkillRequired: null, maxSkillAllowed: 'D',  status: 'open',      notes: null, createdAt: TODAY+'T00:00:00Z', updatedAt: TODAY+'T00:00:00Z', venueName: '球魔方', currentCount: 8  },
  { id: 's3', venueId: 'v2', createdBy: 'u3', sessionDate: TODAY, startTime: '10:00', endTime: '13:00', court: null,  netHeight: 'male',       sessionType: 'intermediate', price: 280, maxCapacity: 12, minSkillRequired: 'B',  maxSkillAllowed: 'A',  status: 'full',      notes: null, createdAt: TODAY+'T00:00:00Z', updatedAt: TODAY+'T00:00:00Z', venueName: 'Ace',   currentCount: 12 },
  { id: 's4', venueId: 'v3', createdBy: 'u2', sessionDate: TODAY, startTime: '14:00', endTime: '17:00', court: 'B館', netHeight: 'male',       sessionType: 'intermediate', price: 300, maxCapacity: 12, minSkillRequired: 'B',  maxSkillAllowed: null, status: 'open',      notes: null, createdAt: TODAY+'T00:00:00Z', updatedAt: TODAY+'T00:00:00Z', venueName: '飛翼',  currentCount: 9  },
  { id: 's5', venueId: 'v5', createdBy: 'u3', sessionDate: TODAY, startTime: '16:00', endTime: '19:00', court: null,  netHeight: 'male',       sessionType: 'advanced',     price: 300, maxCapacity: 10, minSkillRequired: 'A',  maxSkillAllowed: null, status: 'open',      notes: '進階班', createdAt: TODAY+'T00:00:00Z', updatedAt: TODAY+'T00:00:00Z', venueName: 'Playone', currentCount: 7 },
]

export const MOCK_VENUE_SUMMARIES: VenueDailySummary[] = [
  { venueId: 'v1', venueName: '球魔方',  date: TODAY, totalRevenue: 9000,  totalPlayers: 18, totalSessions: 3, unpaidCount: 2, unpaidAmount: 500,  giftRatio: 15, stockAlerts: 0 },
  { venueId: 'v2', venueName: 'Ace',    date: TODAY, totalRevenue: 6720,  totalPlayers: 12, totalSessions: 2, unpaidCount: 0, unpaidAmount: 0,    giftRatio: 8,  stockAlerts: 0 },
  { venueId: 'v3', venueName: '飛翼',   date: TODAY, totalRevenue: 10800, totalPlayers: 21, totalSessions: 4, unpaidCount: 3, unpaidAmount: 900,  giftRatio: 42, stockAlerts: 1 },
  { venueId: 'v4', venueName: '日日',   date: TODAY, totalRevenue: 4000,  totalPlayers: 8,  totalSessions: 2, unpaidCount: 1, unpaidAmount: 200,  giftRatio: 12, stockAlerts: 1 },
  { venueId: 'v5', venueName: 'Playone', date: TODAY, totalRevenue: 7200, totalPlayers: 14, totalSessions: 3, unpaidCount: 1, unpaidAmount: 300,  giftRatio: 20, stockAlerts: 0 },
]

export const MOCK_ALERTS: AnomalyAlert[] = [
  { id: 'a1', type: 'gift_ratio',   severity: 'warning',  venueId: 'v3', venueName: '飛翼',  message: '今日贈送商品比例 42%，超過標準值 20%', createdAt: TODAY+'T14:23:00Z', isRead: false },
  { id: 'a2', type: 'low_stock',    severity: 'warning',  venueId: 'v4', venueName: '日日',  message: '運動飲料庫存剩 3 罐，低於安全水位 5 罐', createdAt: TODAY+'T12:05:00Z', isRead: false },
  { id: 'a3', type: 'revenue_drop', severity: 'warning',  venueId: 'v2', venueName: 'Ace',   message: '本週收入 NT$33,600，較上週同期下降 18%', createdAt: TODAY+'T09:00:00Z', isRead: false },
]

export const MOCK_UNPAID: UnpaidRegistration[] = [
  { registrationId: 'r1', customerName: '林小明', venueId: 'v1', venueName: '球魔方',  sessionDate: TODAY, sessionTime: '09:00', sessionType: 'mixed',        amount: 250, method: 'cash',     waitedMinutes: 120 },
  { registrationId: 'r2', customerName: '陳美玲', venueId: 'v3', venueName: '飛翼',   sessionDate: TODAY, sessionTime: '14:00', sessionType: 'intermediate', amount: 300, method: 'transfer', waitedMinutes: 45  },
  { registrationId: 'r3', customerName: '王大偉', venueId: 'v3', venueName: '飛翼',   sessionDate: TODAY, sessionTime: '14:00', sessionType: 'intermediate', amount: 300, method: 'cash',     waitedMinutes: 45  },
  { registrationId: 'r4', customerName: '張志豪', venueId: 'v4', venueName: '日日',   sessionDate: TODAY, sessionTime: '09:00', sessionType: 'beginner',     amount: 200, method: 'cash',     waitedMinutes: 305 },
  { registrationId: 'r5', customerName: '劉雅婷', venueId: 'v5', venueName: 'Playone', sessionDate: TODAY, sessionTime: '16:00', sessionType: 'advanced',    amount: 300, method: 'transfer', waitedMinutes: 20  },
]

export const MOCK_DASHBOARD: DashboardData = {
  date: TODAY,
  venues: MOCK_VENUE_SUMMARIES,
  totalRevenue: MOCK_VENUE_SUMMARIES.reduce((s, v) => s + v.totalRevenue, 0),
  totalPlayers: MOCK_VENUE_SUMMARIES.reduce((s, v) => s + v.totalPlayers, 0),
  totalSessions: MOCK_VENUE_SUMMARIES.reduce((s, v) => s + v.totalSessions, 0),
  totalUnpaid: MOCK_VENUE_SUMMARIES.reduce((s, v) => s + v.unpaidCount, 0),
  alerts: MOCK_ALERTS,
  unpaidRegistrations: MOCK_UNPAID,
}

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', venueId: null, name: '運動飲料', sku: 'DRK-001', unitPrice: 35,  currentStock: 3,  lowStockThreshold: 5,  isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'p2', venueId: null, name: '護膝',     sku: 'EQP-001', unitPrice: 280, currentStock: 12, lowStockThreshold: 5,  isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'p3', venueId: null, name: '排球',     sku: 'EQP-002', unitPrice: 850, currentStock: 8,  lowStockThreshold: 3,  isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'p4', venueId: 'v1', name: '球魔方帽', sku: 'MRK-001', unitPrice: 250, currentStock: 24, lowStockThreshold: 10, isActive: true, createdAt: '2023-06-01T00:00:00Z' },
]

export const MOCK_PRODUCT_TRANSACTIONS: ProductTransaction[] = [
  { id: 'pt1', productId: 'p1', venueId: 'v3', operatedBy: 'u4', type: 'gift',        quantity: -3, unitPrice: undefined,  totalAmount: undefined, customerId: 'c1', sessionId: 's4', notes: '教練贈送', operatedAt: TODAY+'T14:30:00Z', productName: '運動飲料', operatorName: '工讀生小明', customerName: '林小明'    },
  { id: 'pt2', productId: 'p2', venueId: 'v1', operatedBy: 'u4', type: 'sale',        quantity: -1, unitPrice: 280,        totalAmount: 280,       customerId: 'c3', sessionId: undefined, notes: undefined, operatedAt: TODAY+'T10:15:00Z', productName: '護膝', operatorName: '工讀生小明', customerName: '王大偉' },
  { id: 'pt3', productId: 'p1', venueId: 'v3', operatedBy: 'u2', type: 'gift',        quantity: -2, unitPrice: undefined,  totalAmount: undefined, customerId: undefined, sessionId: 's4', notes: '回饋活動', operatedAt: TODAY+'T13:00:00Z', productName: '運動飲料', operatorName: '王館主', customerName: undefined },
  { id: 'pt4', productId: 'p1', venueId: 'v4', operatedBy: 'u4', type: 'sale',        quantity: -1, unitPrice: 35,         totalAmount: 35,        customerId: 'c4', sessionId: undefined, notes: undefined, operatedAt: TODAY+'T09:30:00Z', productName: '運動飲料', operatorName: '工讀生小明', customerName: '張志豪' },
  { id: 'pt5', productId: 'p3', venueId: 'v1', operatedBy: 'u1', type: 'purchase_in', quantity: 5,  unitPrice: 750,        totalAmount: 3750,      customerId: undefined, sessionId: undefined, notes: '補貨', operatedAt: TODAY+'T08:00:00Z', productName: '排球', operatorName: '陳老闆', customerName: undefined },
]

export async function getDashboard(): Promise<DashboardData> {
  return MOCK_DASHBOARD
}

export async function getVenues(): Promise<Venue[]> {
  return MOCK_VENUES
}

export async function getSessions(venueId?: string, date?: string): Promise<Session[]> {
  let sessions = MOCK_SESSIONS
  if (venueId) sessions = sessions.filter(s => s.venueId === venueId)
  if (date)    sessions = sessions.filter(s => s.sessionDate === date)
  return sessions
}

export async function getProducts(venueId?: string): Promise<Product[]> {
  return MOCK_PRODUCTS.filter(p => !venueId || p.venueId === null || p.venueId === venueId)
}
