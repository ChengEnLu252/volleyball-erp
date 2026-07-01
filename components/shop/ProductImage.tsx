'use client'

// ============================================================
// components/shop/ProductImage.tsx — 商品圖（實拍照 / 品牌佔位圖）
// ============================================================
// 階段 21 新增。
//
//   - product.imageUrl 有值 → 直接顯示實拍照（cover）。
//   - 為 null → 顯示品牌風格佔位圖：奶白→粉的柔感漸層 + 該品類線稿剪影。
//     線稿會吃選到的顏色（accentHex），詳情頁切色時即時換色。
//
// 之後要換實拍照：把圖片放進 /public/shop/，並在 generator 的商品
// 設定 imageUrl: '/shop/xxx.jpg' 即可，前台自動改用實拍照。
// ============================================================

import { BOOKING_COLORS, BOOKING_RADIUS } from '@/components/booking/theme'
import type { ShopProduct } from '@/types'

type Kind =
  | 'jersey' | 'shorts' | 'socks' | 'shoe' | 'sleeve'
  | 'ball' | 'drink' | 'cap' | 'knee' | 'ankle' | 'towel' | 'generic'

function kindFor(p: Pick<ShopProduct, 'id'>): Kind {
  switch (p.id) {
    case 'shop_jersey': return 'jersey'
    case 'shop_shorts': return 'shorts'
    case 'shop5':       return 'socks'
    case 'shop_shoes':  return 'shoe'
    case 'shop_sleeve': return 'sleeve'
    case 'shop1':       return 'drink'
    case 'shop3':       return 'ball'
    case 'shop4':       return 'cap'
    case 'shop2':       return 'knee'
    case 'shop6':       return 'ankle'
    case 'shop7':       return 'towel'
    default:            return 'generic'
  }
}

interface Props {
  product: Pick<ShopProduct, 'id' | 'imageUrl' | 'name' | 'emoji'>
  /** 選到的顏色 hex（詳情頁切色用）；無則用品牌粉 */
  accentHex?: string | null
  /** 圖的圓角；預設 md */
  radius?: number
  /** 額外樣式（通常給高度 / aspect） */
  style?: React.CSSProperties
}

export default function ProductImage({ product, accentHex, radius, style }: Props) {
  const r = radius ?? BOOKING_RADIUS.md

  if (product.imageUrl) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: r, ...style }}>
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  const kind = kindFor(product)
  const fill = accentHex || '#f3c9d6'
  const isLight = isLightColor(fill)
  const stroke = 'rgba(61,42,48,0.42)'
  const detail = isLight ? 'rgba(61,42,48,0.30)' : 'rgba(255,255,255,0.55)'

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: r,
      background: `linear-gradient(155deg, ${BOOKING_COLORS.bgCard} 0%, ${BOOKING_COLORS.bgSecondary} 55%, ${BOOKING_COLORS.pinkSoft} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      {/* 柔光暈 */}
      <div aria-hidden style={{
        position: 'absolute', width: '120%', height: '70%', top: '-18%', left: '-10%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.7), transparent 65%)',
      }} />
      <svg viewBox="0 0 100 100" width="62%" height="62%" style={{ position: 'relative', overflow: 'visible' }}
        fill="none" stroke={stroke} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
        <Glyph kind={kind} fill={fill} detail={detail} />
      </svg>
    </div>
  )
}

// —— 各品類線稿 ——
function Glyph({ kind, fill, detail }: { kind: Kind; fill: string; detail: string }) {
  switch (kind) {
    case 'jersey':
      return (
        <g>
          <path d="M35 22 L28 28 L20 40 L27 46 L33 40 L33 78 L67 78 L67 40 L73 46 L80 40 L72 28 L65 22 C62 28 38 28 35 22 Z" fill={fill} />
          <path d="M42 23 C44 30 56 30 58 23" stroke={detail} />
          <path d="M50 40 L50 60" stroke={detail} strokeWidth={1.6} />
        </g>
      )
    case 'shorts':
      return (
        <g>
          <path d="M30 26 L70 26 L70 50 L62 78 L52 78 L50 52 L48 78 L38 78 L30 50 Z" fill={fill} />
          <path d="M30 30 L70 30" stroke={detail} strokeWidth={1.6} />
        </g>
      )
    case 'socks':
      return (
        <g>
          <path d="M40 20 L54 20 L54 54 C54 60 58 62 64 64 L72 67 C77 69 77 76 72 78 L58 78 C48 78 42 72 42 62 Z" fill={fill} />
          <path d="M40 28 L54 28" stroke={detail} strokeWidth={1.6} />
          <path d="M40 34 L54 34" stroke={detail} strokeWidth={1.6} />
        </g>
      )
    case 'shoe':
      return (
        <g>
          <path d="M18 56 C20 44 30 42 36 46 L50 54 C58 58 70 58 80 58 C85 58 86 64 84 68 L82 70 L20 70 C16 70 15 60 18 56 Z" fill={fill} />
          <path d="M20 70 L82 70 L82 73 C82 74 81 75 80 75 L22 75 C20 75 19 73 20 70 Z" fill={detail} stroke="none" />
          <path d="M34 49 L40 58 M42 52 L48 60 M50 55 L56 61" stroke={detail} strokeWidth={1.6} />
        </g>
      )
    case 'sleeve':
      return (
        <g>
          <path d="M40 18 L60 18 L66 76 C66 80 60 82 56 80 L52 78 L48 78 L44 80 C40 82 34 80 34 76 Z" fill={fill} />
          <path d="M40 26 L60 26" stroke={detail} strokeWidth={1.6} />
          <path d="M50 18 L50 76" stroke={detail} strokeWidth={1.4} />
        </g>
      )
    case 'ball':
      return (
        <g>
          <circle cx="50" cy="50" r="30" fill={fill} />
          <path d="M30 38 C44 44 52 56 56 78 M70 38 C56 44 48 56 44 78 M22 56 C40 52 60 52 78 56" stroke={detail} strokeWidth={1.8} />
        </g>
      )
    case 'drink':
      return (
        <g>
          <path d="M34 38 L66 38 L62 80 L38 80 Z" fill={fill} />
          <path d="M32 38 L68 38" stroke={detail} strokeWidth={2} />
          <path d="M54 38 L60 20" stroke={detail} strokeWidth={2.2} />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path d="M26 56 C26 38 74 38 74 56 Z" fill={fill} />
          <path d="M24 56 C36 50 70 50 84 60 C84 64 78 64 74 62 C70 60 30 60 26 60 C24 60 24 58 24 56 Z" fill={detail} stroke="none" />
        </g>
      )
    case 'knee':
      return (
        <g>
          <rect x="30" y="26" width="40" height="48" rx="14" fill={fill} />
          <path d="M30 40 L70 40 M30 60 L70 60" stroke={detail} strokeWidth={1.6} />
        </g>
      )
    case 'ankle':
      return (
        <g>
          <path d="M36 24 L64 24 L64 56 C64 70 36 70 36 56 Z" fill={fill} />
          <path d="M36 46 C44 52 56 52 64 46" stroke={detail} strokeWidth={1.8} />
        </g>
      )
    case 'towel':
      return (
        <g>
          <rect x="26" y="30" width="48" height="40" rx="5" fill={fill} />
          <path d="M34 30 L34 70 M66 30 L66 70" stroke={detail} strokeWidth={1.6} />
        </g>
      )
    default:
      return <circle cx="50" cy="50" r="28" fill={fill} />
  }
}

function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return true
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  // 感知亮度
  return (0.299 * r + 0.587 * g + 0.114 * b) > 175
}
