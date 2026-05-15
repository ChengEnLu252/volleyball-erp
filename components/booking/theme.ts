// ============================================================
// components/booking/theme.ts — 客戶端報名頁設計 token
// ============================================================
// 階段 12 新增。所有客戶端 (/book/*) 頁面共用此 token，
// 與 ERP 後台 (深色 / 奶白) 區隔。
//
// 設計方向：「日式柔感運動」
//   - 主色：淡粉，奶白暖底，深紫灰文字
//   - Display 字：Noto Serif TC（中文 serif，有質感）
//   - Body 字：Noto Sans TC
//   - 圓角大、留白多、陰影用粉色低透明
//   - 不走甜膩糖果色；粉是 accent，奶白是主場
// ============================================================

export const BOOKING_COLORS = {
  /** 主背景 — 奶白偏暖 */
  bgPrimary: '#fdfaf7',
  /** 卡片白 */
  bgCard: '#ffffff',
  /** 次背景（區塊分隔、disabled 日期、淡淡的腮紅） */
  bgSecondary: '#faf1ec',

  /** 主粉 — 淡櫻花粉 */
  pink: '#f5c6d4',
  /** 深粉 — 按鈕主色 */
  pinkDeep: '#c97493',
  /** 粉的暗影 (hover/active) */
  pinkDarker: '#a85878',
  /** 粉影 (selection/highlight 底) */
  pinkSoft: '#fce7ee',
  /** 粉邊 */
  pinkBorder: '#f1d4dd',

  /** 可愛運動風 — 強調活力的亮粉 (CTA / Logo 用) */
  pinkVivid: '#ff6b9d',
  /** 強調活力的亮粉 — 文字版（對比比 deep 高） */
  pinkVividDeep: '#e54877',

  /** 文字 — 帶粉的深紫，比純黑柔 */
  textPrimary: '#3d2a30',
  textSecondary: '#7a5b65',
  textMuted: '#a98e96',

  /** 邊框 — 粉灰 */
  border: '#ecdce3',
  borderLight: '#f5e8ee',

  /** Aircon icon 用淡藍 accent (粉色系外的對比，視覺呼吸) */
  aircon: '#7fb6d8',
  airconBg: '#e8f4fa',

  /** 警告 / 已滿 — 用沉的玫瑰紅，避免亮紅破壞色調 */
  warn: '#c9425e',
  warnBg: '#fbe9ed',

  /** Success / 報名成功 — 用沉橄欖綠 */
  ok: '#7a9870',
  okBg: '#eef3ec',

  /** LINE 綠（官方品牌色，不可改）*/
  lineGreen: '#06c755',
} as const

export const BOOKING_FONTS = {
  display: `"Noto Serif TC", "PingFang TC", "Songti TC", serif`,
  body: `"Noto Sans TC", "PingFang TC", "Helvetica Neue", sans-serif`,
  /** tabular-num — 給金額 / 場次數字用 */
  num: `"Noto Sans TC", system-ui, sans-serif`,
} as const

export const BOOKING_SHADOWS = {
  /** 卡片淡陰影 — 粉色微透明 */
  card: '0 1px 3px rgba(184, 100, 130, 0.06), 0 6px 18px rgba(184, 100, 130, 0.04)',
  /** 卡片 hover */
  cardHover: '0 2px 5px rgba(184, 100, 130, 0.08), 0 10px 28px rgba(184, 100, 130, 0.08)',
  /** 重要 CTA 按鈕陰影 */
  cta: '0 4px 14px rgba(201, 116, 147, 0.28)',
  /** Modal 陰影 */
  modal: '0 24px 60px rgba(120, 60, 80, 0.18)',
} as const

export const BOOKING_RADIUS = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  /** 大卡片 */
  card: 20,
  /** Pill 用 */
  pill: 999,
} as const

// ============================================================
// 程度等級對照（沿用 ERP 系統的字母制，加 tooltip 說明）
// ============================================================

export const SKILL_DESCRIPTIONS: Record<string, string> = {
  E:  'E 級 · 完全新手，沒打過排球',
  D:  'D 級 · 知道動作但無法完整執行',
  C:  'C 級 · 可做出連貫動作',
  B:  'B 級 · 系隊先發程度',
  'B+': 'B+ 級 · 一般系隊頂尖',
  A:  'A 級 · 校隊先發程度',
  'A+': 'A+ 級 · 校隊頂尖',
  S:  'S 級 · 公開組',
  'S*': 'S* 級 · 職業等級',
}

export const SKILL_OPTIONS = ['E', 'D', 'C', 'B', 'B+', 'A', 'A+', 'S', 'S*'] as const

// ============================================================
// 場次型態文字
// ============================================================

export const SESSION_TYPE_LABEL: Record<string, string> = {
  male_only: '男網純男場',
  male_mixed: '男網混排',
  male_position: '男網專位',
  female_only: '女網純女場',
  female_mixed: '女網混排',
  female_position: '女網專位',
  rental: '包場',
}

/** 場次型態的小色塊（卡片左邊 tag 用） */
export const SESSION_TYPE_TAG_COLOR: Record<string, { bg: string; text: string }> = {
  male_only:       { bg: '#e8f0fb', text: '#385d8a' },
  male_mixed:      { bg: '#eee6f3', text: '#5f4477' },
  male_position:   { bg: '#dff0f6', text: '#386576' },
  female_only:     { bg: '#fce7ee', text: '#9a3855' },
  female_mixed:    { bg: '#fbecf2', text: '#a14868' },
  female_position: { bg: '#f7dfee', text: '#823568' },
  rental:          { bg: '#e8f1e6', text: '#4d6b48' },
}
