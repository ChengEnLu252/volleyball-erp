# VolleyOps · 粉紅運動科技風 · v1 改造手冊

> 階段 1 改造範圍：3 個核心元件 + 設計系統基礎建設
> 之後其他頁面（sessions、finance、reconciliation 等）可直接照同樣 pattern rollout

---

## 一、本次新增 / 修改的檔案

### 🆕 新增

| 路徑 | 用途 |
|---|---|
| `components/theme/tokens.ts` | 全域設計 token：顏色、字體、陰影、場館色、角色色 |
| `components/QiuQiu.tsx` | 球球吉祥物元件（3 種 variant：full / mini / face）|

### ✏️ 修改（業務邏輯 100% 保留，只重寫視覺）

| 路徑 | 變動 |
|---|---|
| `app/globals.css` | 加 Google Fonts、CSS variables、動畫 keyframes、scrollbar、selection |
| `app/layout.tsx` | 移除 inline body style（改由 globals.css 統一管理）|
| `components/Sidebar.tsx` | 粉色漸層側欄、HUD 風格、球球 watermark、密碼 modal 改版 |
| `components/LoginGate.tsx` | 粉紅 hero 登入頁、球球擔任主角 |
| `app/dashboard/page.tsx` | HUD stat cards、bracket header、Live indicator、球球 hero |

---

## 二、設計 Token 速查

```ts
import { COLORS, FONTS, SHADOWS, RADIUS, VENUE_COLOR, roleColor } from '@/components/theme/tokens'

COLORS.pink500   // #ff2d8a — 主品牌粉
COLORS.purple    // #7c5cff — 科技 accent
COLORS.cyan      // #4dd4e0 — 資料 / LIVE
COLORS.amber     // #ffb84d — 警示
COLORS.ink900    // #2d1b2e — 主要文字（暖紫黑）
COLORS.surface   // #fffafc — 卡片白
FONTS.mono       // JetBrains Mono — 給數字 / ID / timestamp
```

## 三、球球吉祥物用法

```tsx
import QiuQiu from '@/components/QiuQiu'

// 全身（dashboard hero）
<QiuQiu variant="full" size={108} rotate={-6} bob />

// Sidebar watermark
<QiuQiu variant="mini" size={58} opacity={0.4} />

// 小頭像（行內 / 空狀態 / modal）
<QiuQiu variant="face" size={44} />

// 自訂號碼（預設 87）
<QiuQiu variant="full" size={120} number={7} />
```

## 四、HUD 視覺元件清單

### Bracket 標題
```tsx
<span className="vop-mono">[</span>
<span>標題文字</span>
<span className="vop-mono">]</span>
```

### Mono 字體
給數字、ID、timestamp、英文標籤：
```tsx
<span className="vop-mono">$48,200</span>
<span className="vop-mono">#001 · 14:23</span>
```

### Pulse 動畫（LIVE 指示燈）
```tsx
<span className="vop-ping" style={{
  width: 6, height: 6, borderRadius: '50%',
  background: '#ff2d8a',
  boxShadow: '0 0 8px #ff2d8a',
}} />
```

### Glow 動畫（active item）
```tsx
<div style={{ animation: 'vop-glow 2.6s ease-in-out infinite' }}>...</div>
```

### HUD 4 角括弧（卡片用）
要 `position: relative` 的父容器加 4 個 `<span>` 在角落：
```tsx
<div style={{ position: 'relative' }}>
  <span style={{ position:'absolute', top:-1, left:-1, width:7, height:7,
    borderTop:`1.5px solid ${accent}`, borderLeft:`1.5px solid ${accent}` }} />
  {/* 其他 3 角同理 */}
</div>
```

---

## 五、之後 rollout 其他頁面的 SOP

每頁照這個 checklist 改：

1. **import token** — 把 hex 換成 `COLORS.xxx`
2. **背景** — 卡片用 `COLORS.surface` (`#fffafc`)，副區域用 `COLORS.pink50`
3. **邊框** — 從 `#e8e6e0` 換成 `COLORS.border` (`#ffc4d8`)
4. **文字** — 從 `#1a1917` / `#888` 換成 `COLORS.ink900` / `COLORS.ink500`
5. **強調色** — 從金 `#d4a843` / 藍 `#2563eb` 換成 `COLORS.pink500` / `COLORS.purple`
6. **數字 / ID** — 加 `className="vop-mono"`
7. **標題** — 包 `[ ]` bracket（用 vop-mono）
8. **stat / metric cards** — 加 HUD 4 角（看 `Dashboard StatCard` 的 pattern）
9. **空狀態** — 用 `<QiuQiu variant="face" />` 加文字
10. **active item** — 加粉色漸層 + box-shadow glow + 可選 `animation: vop-glow`

---

## 六、待 rollout 頁面清單

- [ ] `/sessions` — 場次管理（list + new + [id]）
- [ ] `/booking-overview` — 報名熱度
- [ ] `/checkin` — 前台操作
- [ ] `/customers` — 客戶資料
- [ ] `/products` — 商品管理
- [ ] `/finance` — 財務報表（+ /payments、/refunds）
- [ ] `/performance` — 館長績效
- [ ] `/reconciliation/*` — 對帳系統（7 個 sub-page）
- [ ] `/captains` — 主揪管理
- [ ] `/audit` — 操作紀錄
- [ ] `/evidence` — 上傳憑證
- [ ] `/integrations` — 整合設定
- [ ] `components/AiSection.tsx` — AI 對話視窗（球球可化身助理頭像）
- [ ] `/book/*` — 客戶報名頁（已是粉色系，做風格收斂 / 統一即可）
- [ ] `/captain/[token]` — 主揪頁
- [ ] `/self-checkin/[sessionId]` — 自助報到頁

---

## 七、技術備註

- **未動 package.json** — 沒新增任何 dependency，只多了 Google Fonts CDN（透過 globals.css `@import`）
- **未動 data/* / types/* / prisma/*** — 完全沒碰業務邏輯
- **未動 ChromeShell / LayoutGuard** — 路由 / 權限結構保持不變
- **未動 /book/* / /captain/* / /self-checkin/*** — 客戶端公開頁保留原樣

如果要把 Google Fonts 改成 `next/font` 自託管（效能更好）— 之後可以做，不影響視覺。
