// ============================================================
// components/theme/tokens.ts — 全域設計 token
// ============================================================
// 風格：粉紅可愛 × 科技感 × 運動風
//
// 主色 #ff2d8a — 偏冷電光的桃紅，不甜不少女
// 紫 #7c5cff、青 #4dd4e0 → 科技 accent
// 文字用暖紫黑 #2d1b2e（比純黑柔，搭粉色更自然）
//
// 所有頁面共用此 token；不要再亂寫 hex。
// ============================================================

export const COLORS = {
  // —— 主粉色階 ——
  pink50:  '#fff5fa',
  pink100: '#ffe2ed',
  pink200: '#ffc4d8',
  pink300: '#ff9ec0',
  pink400: '#ff5fa3',
  pink500: '#ff2d8a',  // ★ 主品牌粉
  pink600: '#e0186f',
  pink700: '#c91d5a',
  pink900: '#8a0d3f',

  // —— 紫色 accent（科技感）——
  purple:      '#7c5cff',
  purpleLight: '#d4c8ff',
  purpleDeep:  '#5d4ab8',

  // —— 青色 accent（資料 / LIVE）——
  cyan:      '#4dd4e0',
  cyanLight: '#b5e8ee',
  cyanDeep:  '#0d8a98',

  // —— 琥珀（警示 / 未付款）——
  amber:      '#ffb84d',
  amberLight: '#ffe0a8',
  amberDeep:  '#946700',

  // —— 文字 ——
  ink900: '#2d1b2e',  // 主要文字 — 暖紫黑
  ink700: '#5d4858',
  ink500: '#7d6470',
  ink300: '#a98e96',
  ink200: '#c9a3b3',

  // —— 表面 ——
  surface:     '#fffafc',  // 卡片白（偏粉）
  surfaceTint: '#fff5fa',  // 主區次背景
  surfaceDeep: '#fdeef5',  // 最外層

  // —— 邊框 ——
  border:      '#ffc4d8',
  borderLight: '#ffe2ed',

  // —— 狀態 ——
  success:   '#067a5b',
  successBg: '#e0f5ed',
  warn:      '#856404',
  warnBg:    '#fff3cd',
  warnBorder:'#ffe09c',
  danger:    '#9d174d',
  dangerBg:  '#fce7f3',

  // —— 角色色（取代舊金/藍/灰）——
  roleOwner:   '#ff2d8a',  // 主粉 — 老闆
  roleManager: '#7c5cff',  // 紫 — 館長
  roleStaff:   '#a98e96',  // 灰粉 — 員工
} as const

export const FONTS = {
  sans:    `'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`,
  mono:    `'JetBrains Mono', 'SF Mono', ui-monospace, 'Menlo', monospace`,
  display: `'Noto Sans TC', -apple-system, BlinkMacSystemFont, sans-serif`,
} as const

export const SHADOWS = {
  pinkGlow:    '0 0 14px rgba(255,45,138,0.4), 0 4px 12px -2px rgba(255,45,138,0.5)',
  pinkGlowSm:  '0 0 8px rgba(255,45,138,0.3), 0 2px 6px -1px rgba(255,45,138,0.3)',
  card:        '0 4px 16px -4px rgba(255,45,138,0.1), 0 0 0 1px rgba(255,45,138,0.04)',
  cardHover:   '0 8px 24px -4px rgba(255,45,138,0.18), 0 0 0 1px rgba(255,45,138,0.08)',
  modal:       '0 24px 60px -12px rgba(255,45,138,0.3), 0 0 0 1px rgba(255,45,138,0.1)',
} as const

export const RADIUS = {
  sm: 6,
  md: 9,
  lg: 12,
  xl: 16,
  pill: 999,
} as const

// —— 場館顏色（取代舊版彩虹色，改成搭配粉紅科技風）——
export const VENUE_COLOR: Record<string, string> = {
  v1: '#ff2d8a',  // 主粉
  v2: '#7c5cff',  // 紫
  v3: '#4dd4e0',  // 青
  v4: '#ffb84d',  // 琥珀
  v5: '#ff8fab',  // 淺粉
  v6: '#a89dff',  // 淺紫
}

// —— 角色色 helper ——
export function roleColor(role: string): string {
  if (role === 'owner')   return COLORS.roleOwner
  if (role === 'manager') return COLORS.roleManager
  if (role === 'staff')   return COLORS.roleStaff
  return COLORS.ink500
}
