// ============================================================
// data/shop-types.ts — 商城前台 view 型別（client + server 共用）
// ------------------------------------------------------------
// 純型別，無 runtime import，可安全被 client component 引用
// （queries.ts 是 server-only、shop.ts 是 'use server' 都不能匯出型別）。
// ============================================================

export type StoreColor = { name: string; hex: string }
export type StoreVariant = { size: string | null; color: string | null; stock: number }
export type StoreCategory = { id: string; name: string; slug: string }

export type StoreProduct = {
  id: string
  name: string
  unitPrice: number
  /** 原價（劃線價）；null = 無特價 */
  compareAtPrice: number | null
  onlineStock: number
  isListed: boolean
  description: string
  emoji: string
  /** 第一張圖（無圖為 null → 前台用品牌佔位圖） */
  imageUrl: string | null
  images: string[]
  sizes: string[]
  colors: StoreColor[]
  variants: StoreVariant[]
  categories: StoreCategory[]
}

// —— 訂單（SC5：結帳 / 確認 / 查詢）——
export type FulfillmentType = 'pickup' | 'shipping'
export type PaymentChannel = 'cash_on_pickup' | 'cash_on_delivery' | 'online_gateway'
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled'

export type ShippingInfoView = { recipient: string; phone: string; address: string }

export type OrderItemView = {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  subtotal: number
  size: string | null
  color: string | null
  imageUrl: string | null
}

export type OrderView = {
  id: string
  orderNo: string
  status: OrderStatus
  customerName: string
  customerPhone: string
  customerEmail: string | null
  itemTotal: number
  shippingFee: number
  total: number
  fulfillment: FulfillmentType
  pickupVenueId: string | null
  pickupVenueName: string | null
  shipping: ShippingInfoView | null
  paymentChannel: PaymentChannel
  notes: string | null
  createdAt: string
  items: OrderItemView[]
}

export type OrderChannel = 'online' | 'backend'

/** 後台訂單（比前台 OrderView 多通路 / 時間戳 / 物流 / 代客操作員） */
export type AdminOrder = OrderView & {
  channel: OrderChannel
  placedByUserId: string | null
  placedByName: string | null
  paidAt: string | null
  fulfilledAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  trackingNumber: string | null
  shippingProvider: string | null
  shippedAt: string | null
}

/** 結帳送出的輸入 */
export type PlaceOrderInput = {
  customerName: string
  customerPhone: string
  customerEmail: string | null
  items: { productId: string; quantity: number; size: string | null; color: string | null }[]
  fulfillment: FulfillmentType
  pickupVenueId: string | null
  shipping: ShippingInfoView | null
  paymentChannel: PaymentChannel
  notes: string | null
}

export const SHOP_SHIPPING_FEE = 80

// —— 後台商品管理（SC2）——
export type ShopVariantInput = { size: string | null; color: string | null; stock: number; sku: string | null }

export type ShopProductSaveInput = {
  id?: string // undefined = 新增
  name: string
  unitPrice: number
  compareAtPrice: number | null
  description: string
  emoji: string
  isListed: boolean
  categoryIds: string[]
  images: string[] // 圖片網址（依序）
  sizes: string[]
  colors: StoreColor[]
  /** 有規格軸時：各規格庫存 / SKU；無軸時忽略，用 onlineStock */
  variants: ShopVariantInput[]
  /** 無規格軸商品的庫存 */
  onlineStock: number
}
