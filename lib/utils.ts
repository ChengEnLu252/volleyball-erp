// 共用工具函式

/** 金額格式化，例如 12600 → "NT$12,600" */
export function formatCurrency(amount: number): string {
  return `NT$${amount.toLocaleString('zh-TW')}`
}

/** 日期格式化，例如 "2026-04-14" → "4月14日（二）" */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getMonth() + 1}月${date.getDate()}日（${days[date.getDay()]}）`
}

/** 程度標籤顏色（給 Tailwind class 用） */
export const SKILL_COLOR: Record<string, string> = {
  beginner:     'bg-green-100 text-green-800',
  elementary:   'bg-blue-100 text-blue-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced:     'bg-orange-100 text-orange-800',
  expert:       'bg-red-100 text-red-800',
}

/** 付款狀態顏色 */
export const PAYMENT_COLOR: Record<string, string> = {
  paid:     'bg-green-100 text-green-800',
  partial:  'bg-yellow-100 text-yellow-800',
  unpaid:   'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
}
