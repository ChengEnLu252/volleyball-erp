'use client'

// ============================================================
// /shop-products — 商城商品管理（SC2：新增/編輯/刪除 + 規格矩陣）
// ============================================================
// owner / manager：管理單一線上商城的商品。staff 擋（server action 授權）。
//   - 商品列表（含下架）：縮圖 / 名稱 / 價格 / 庫存 / 分類 / 上下架
//   - 新增 / 編輯：名稱、售價、原價(特價)、描述、emoji、上下架、
//     分類(多選+新增)、圖片(網址)、尺寸/顏色軸 → 規格矩陣(各庫存+SKU)
//   - 刪除（連同規格/圖/分類）
// 圖片上傳留 SC6（現以網址管理；既有商品已帶真圖網址）。
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadShopAdminAction, saveShopProductAction, deleteShopProductAction, createShopCategoryAction,
} from '@/app/actions/shop-admin'
import type { StoreProduct, StoreCategory, StoreColor, ShopProductSaveInput } from '@/data/shop-types'
import { COLORS, FONTS } from '@/components/theme/tokens'

export default function ShopProductsPage() {
  const [data, setData] = useState<{ products: StoreProduct[]; categories: StoreCategory[] } | null | undefined>(undefined)
  const [editing, setEditing] = useState<StoreProduct | 'new' | null>(null)

  const refresh = useCallback(async () => {
    const r = await loadShopAdminAction()
    setData(r.ok ? { products: r.products, categories: r.categories } : null)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const del = async (p: StoreProduct) => {
    if (!window.confirm(`確定刪除「${p.name}」？此動作無法復原（連同規格 / 圖片 / 分類）。`)) return
    const r = await deleteShopProductAction(p.id)
    if (!r.ok) window.alert(r.reason)
    await refresh()
  }

  if (data === undefined) return <Shell><Empty text="載入中…" /></Shell>
  if (data === null) return <Shell><div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.ink500, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}><div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>此頁僅限館長／老闆</div></Shell>

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>商城商品</h1>
          <p style={{ fontSize: 13, color: COLORS.ink500, margin: '4px 0 0' }}>管理線上商城的商品、規格、分類與上下架（共 {data.products.length} 項）</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/shop" target="_blank" style={{ padding: '9px 14px', borderRadius: 9, background: '#fff', border: `1px solid ${COLORS.border}`, color: COLORS.ink700, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>🛍️ 開啟商城 ↗</a>
          <button onClick={() => setEditing('new')} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(255,45,138,0.5)' }}>＋ 新增商品</button>
        </div>
      </div>

      <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        {data.products.map((p) => {
          const onSale = !!p.compareAtPrice && p.compareAtPrice > p.unitPrice
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${COLORS.borderLight}`, opacity: p.isListed ? 1 : 0.6 }}>
              <div style={{ width: 46, height: 46, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: COLORS.surfaceTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: COLORS.ink300, marginTop: 2 }}>
                  {p.categories.map((c) => c.name).join('・') || '未分類'}
                  {p.variants.length > 0 && ` · ${p.variants.length} 規格`}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 78 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.pink600 }}>${p.unitPrice}</div>
                {onSale && <div style={{ fontSize: 11, color: COLORS.ink300, textDecoration: 'line-through' }}>${p.compareAtPrice}</div>}
              </div>
              <div style={{ fontSize: 12, color: p.onlineStock <= 5 ? COLORS.danger : COLORS.ink500, minWidth: 56, textAlign: 'right' }}>庫存 {p.onlineStock}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: p.isListed ? COLORS.successBg : COLORS.surfaceTint, color: p.isListed ? COLORS.success : COLORS.ink300 }}>{p.isListed ? '上架中' : '已下架'}</span>
              <button onClick={() => setEditing(p)} style={smallBtn}>編輯</button>
              <button onClick={() => del(p)} style={{ ...smallBtn, color: COLORS.danger, borderColor: COLORS.dangerBg }}>刪除</button>
            </div>
          )
        })}
        {data.products.length === 0 && <Empty text="尚無商品，點右上「新增商品」開始" />}
      </div>

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh() }}
          onCategoryAdded={refresh}
        />
      )}
    </Shell>
  )
}

// ============================================================
// 商品編輯器
// ============================================================
type VData = Record<string, { stock: string; sku: string }> // key = `${size}|${color}`

function ProductEditor({ product, categories, onClose, onSaved, onCategoryAdded }: {
  product: StoreProduct | null
  categories: StoreCategory[]
  onClose: () => void
  onSaved: () => void
  onCategoryAdded: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [unitPrice, setUnitPrice] = useState(String(product?.unitPrice ?? ''))
  const [compareAt, setCompareAt] = useState(product?.compareAtPrice != null ? String(product.compareAtPrice) : '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [emoji, setEmoji] = useState(product?.emoji ?? '🏐')
  const [isListed, setIsListed] = useState(product?.isListed ?? true)
  const [catIds, setCatIds] = useState<Set<string>>(new Set(product?.categories.map((c) => c.id) ?? []))
  const [images, setImages] = useState<string[]>(product?.images.length ? [...product.images] : [''])
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? [])
  const [colors, setColors] = useState<StoreColor[]>(product?.colors ?? [])
  const [onlineStock, setOnlineStock] = useState(String(product && product.variants.length === 0 ? product.onlineStock : 0))
  const [vdata, setVdata] = useState<VData>(() => {
    const m: VData = {}
    for (const v of product?.variants ?? []) m[`${v.size ?? ''}|${v.color ?? ''}`] = { stock: String(v.stock), sku: '' }
    return m
  })
  const [sizeInput, setSizeInput] = useState('')
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('#f7b8cd')
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const hasAxes = sizes.length > 0 || colors.length > 0

  // 規格矩陣列
  const matrix = useMemo(() => {
    const rows: { size: string | null; color: string | null; key: string }[] = []
    const S = sizes.length ? sizes : [null]
    const C = colors.length ? colors.map((c) => c.name) : [null]
    for (const s of S) for (const c of C) {
      if (s === null && c === null) continue
      rows.push({ size: s, color: c, key: `${s ?? ''}|${c ?? ''}` })
    }
    return rows
  }, [sizes, colors])

  const setCell = (key: string, field: 'stock' | 'sku', val: string) =>
    setVdata((m) => ({ ...m, [key]: { stock: m[key]?.stock ?? '0', sku: m[key]?.sku ?? '', [field]: val } }))

  const addSize = () => { const s = sizeInput.trim(); if (s && !sizes.includes(s)) setSizes([...sizes, s]); setSizeInput('') }
  const addColor = () => { const n = colorName.trim(); if (n && !colors.some((c) => c.name === n)) setColors([...colors, { name: n, hex: colorHex }]); setColorName('') }

  const addNewCategory = async () => {
    const nm = newCat.trim(); if (!nm) return
    const r = await createShopCategoryAction({ name: nm })
    if (!r.ok) { window.alert(r.reason); return }
    setCatIds((s) => new Set([...s, r.category.id]))
    setNewCat('')
    onCategoryAdded()
  }

  const save = async () => {
    setError('')
    if (!name.trim()) { setError('請填寫商品名稱'); return }
    setSaving(true)
    const input: ShopProductSaveInput = {
      id: product?.id,
      name, unitPrice: parseInt(unitPrice, 10) || 0,
      compareAtPrice: compareAt.trim() ? (parseInt(compareAt, 10) || null) : null,
      description, emoji, isListed,
      categoryIds: [...catIds],
      images: images.map((i) => i.trim()).filter(Boolean),
      sizes, colors,
      variants: hasAxes ? matrix.map((r) => ({ size: r.size, color: r.color, stock: parseInt(vdata[r.key]?.stock ?? '0', 10) || 0, sku: vdata[r.key]?.sku?.trim() || null })) : [],
      onlineStock: parseInt(onlineStock, 10) || 0,
    }
    const r = await saveShopProductAction(input)
    setSaving(false)
    if (!r.ok) { setError(r.reason); return }
    onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(45,27,46,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3)', fontFamily: FONTS.sans, color: COLORS.ink900 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${COLORS.borderLight}`, position: 'sticky', top: 0, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{product ? '編輯商品' : '新增商品'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.ink300 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          <L>商品名稱 *</L>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：厭世小狗 T-shirt" style={inp} />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><L>售價 *</L><input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} type="number" placeholder="300" style={inp} /></div>
            <div style={{ flex: 1 }}><L>原價（劃線，選填）</L><input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} type="number" placeholder="留空=無特價" style={inp} /></div>
            <div style={{ width: 74 }}><L>圖示</L><input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} style={{ ...inp, textAlign: 'center' }} /></div>
          </div>

          <L>商品描述</L>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="商品文案 / 材質…" style={{ ...inp, resize: 'vertical' }} />

          <L>分類</L>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {categories.map((c) => {
              const on = catIds.has(c.id)
              return (
                <button key={c.id} onClick={() => setCatIds((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} style={{
                  padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${on ? COLORS.pink500 : COLORS.border}`, background: on ? COLORS.pink50 : '#fff', color: on ? COLORS.pink600 : COLORS.ink500,
                }}>{c.name}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="新增分類…" style={{ ...inp, marginBottom: 0, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewCategory() } }} />
            <button onClick={addNewCategory} style={ghostBtn}>＋ 分類</button>
          </div>

          <L>商品圖片（網址）<span style={{ fontWeight: 400, color: COLORS.ink300 }}>　上傳功能後續開放，現以網址管理</span></L>
          {images.map((img, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: COLORS.surfaceTint }}>{img.trim() && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
              <input value={img} onChange={(e) => setImages((a) => a.map((x, j) => j === i ? e.target.value : x))} placeholder="https://…" style={{ ...inp, marginBottom: 0, flex: 1 }} />
              <button onClick={() => setImages((a) => a.filter((_, j) => j !== i))} style={{ ...ghostBtn, color: COLORS.danger }}>移除</button>
            </div>
          ))}
          <button onClick={() => setImages((a) => [...a, ''])} style={{ ...ghostBtn, marginBottom: 16 }}>＋ 圖片</button>

          {/* 規格軸 */}
          <L>尺寸</L>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {sizes.map((s) => <Chip key={s} onRemove={() => setSizes(sizes.filter((x) => x !== s))}>{s}</Chip>)}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} placeholder="例：M、EU 42…" style={{ ...inp, marginBottom: 0, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize() } }} />
            <button onClick={addSize} style={ghostBtn}>＋ 尺寸</button>
          </div>

          <L>顏色</L>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {colors.map((c) => <Chip key={c.name} onRemove={() => setColors(colors.filter((x) => x.name !== c.name))}><span style={{ width: 11, height: 11, borderRadius: '50%', background: c.hex, border: `1px solid ${COLORS.border}`, display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />{c.name}</Chip>)}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} style={{ width: 40, height: 38, padding: 2, borderRadius: 8, border: `1.5px solid ${COLORS.border}`, cursor: 'pointer' }} />
            <input value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="顏色名，例：奶狗粉" style={{ ...inp, marginBottom: 0, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor() } }} />
            <button onClick={addColor} style={ghostBtn}>＋ 顏色</button>
          </div>

          {/* 庫存 / 規格矩陣 */}
          {hasAxes ? (
            <>
              <L>規格庫存（{matrix.length} 組，總庫存 {matrix.reduce((s, r) => s + (parseInt(vdata[r.key]?.stock ?? '0', 10) || 0), 0)}）</L>
              <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                {matrix.map((r) => (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 9, background: COLORS.surfaceTint }}>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: COLORS.ink700 }}>{[r.size, r.color].filter(Boolean).join('・')}</span>
                    <input value={vdata[r.key]?.sku ?? ''} onChange={(e) => setCell(r.key, 'sku', e.target.value)} placeholder="SKU" style={{ ...inp, marginBottom: 0, width: 110, padding: '5px 8px', fontSize: 12 }} />
                    <input type="number" value={vdata[r.key]?.stock ?? '0'} onChange={(e) => setCell(r.key, 'stock', e.target.value)} style={{ ...inp, marginBottom: 0, width: 62, padding: '5px 8px', fontSize: 13, textAlign: 'center' }} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <L>庫存</L>
              <input value={onlineStock} onChange={(e) => setOnlineStock(e.target.value)} type="number" style={{ ...inp, width: 120 }} />
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>上架中（顧客可在商城看到並購買）</span>
          </label>

          {error && <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: COLORS.dangerBg, color: COLORS.danger, fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ ...ghostBtn, flex: 1, padding: '12px' }}>取消</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 999, border: 'none', background: saving ? COLORS.border : `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>{saving ? '儲存中…' : (product ? '儲存變更' : '建立商品')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// —— 小元件 ——
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}><style>{`@media(max-width:768px){.sp-wrap{padding-top:64px !important}}`}</style><div className="sp-wrap">{children}</div></div>
}
function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '50px 20px', color: COLORS.ink300, fontSize: 14 }}>{text}</div>
}
function L({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.ink700, margin: '10px 0 6px' }}>{children}</div>
}
function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 11px', borderRadius: 999, background: COLORS.surfaceTint, fontSize: 12, fontWeight: 600, color: COLORS.ink700 }}>
      {children}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.ink300, fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
    </span>
  )
}

const smallBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.ink700, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.ink700, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${COLORS.border}`, fontSize: 14, marginBottom: 4, outline: 'none', background: '#fff', color: COLORS.ink900 }
