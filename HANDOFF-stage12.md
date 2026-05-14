# HANDOFF — Stage 12

> 階段 12：重做客戶端報名系統 + ERP 後台報名熱度看板 + 新增場次功能

## 0. TL;DR

- **報名頁** (`/book/[venue]`) 從場次清單改成「日式柔感」粉色三層結構：日曆首頁 → 當日場次 → 場次詳情 + 報名 form
- 報名頁完全擺脫 ERP chrome（透過 `ChromeShell` 條件包裝）
- LINE 登入為「殼」（mock，預留真實 OAuth 接口）
- 付款 3 選：現場付現 / 現場 LINE Pay / 現場轉帳，**永不串金流**
- 7 館真實 LINE 官方帳號連結已寫入 footer
- ERP 後台新增 `/booking-overview`（報名熱度看板）+ `/sessions/new`（範本批量 + 單場手動）
- `Session` 首次成為 mutable（store 加 `addSession()`、`PersistedDiff.sessionsAdded`）

## 1. 改動清單

### 1.1 新增的檔案

| 路徑 | 用途 |
|---|---|
| `components/ChromeShell.tsx` | 條件式 sidebar wrapper（`/book/*` 走純 children，其他套 ERP chrome） |
| `components/booking/theme.ts` | 粉色設計 token + 程度/場次型態文字對照 |
| `components/booking/BookingShell.tsx` | 報名頁共用 layout（Hero / CompactBar / Footer + Google Fonts 注入） |
| `components/booking/BookingCalendar.tsx` | 月曆組件（粉點標示有場次、灰底已額滿、可前後翻月） |
| `components/booking/SessionCard.tsx` | 場次卡片（時間 + tags + 費用拆分 + 容量條 + 程度 tooltip） |
| `components/booking/LineLoginModal.tsx` | LINE 登入殼 + `sessionStorage` user store |
| `app/book/[venue]/[date]/page.tsx` | 當日場次清單頁 |
| `app/book/[venue]/[date]/[sessionId]/page.tsx` | 場次詳情 + 報名 form（含三選付款 / 程度自評 / 同意條款） |
| `app/booking-overview/page.tsx` | ERP 後台報名熱度看板（按館 × 按日聚合，未來 14 天） |
| `app/sessions/new/page.tsx` | 新增場次頁（範本批量 + 單場手動兩 tab） |

### 1.2 修改的檔案

| 路徑 | 改動概要 |
|---|---|
| `types/index.ts` | `AuditAction` 加 `CREATE_SESSION` |
| `data/api.ts` | `VENUE_BY_SLUG_RAW` 加 `brandSubtitle` + `lineOfficialUrl`（7 館真實 LINE URL）<br>`PublicSession` 從 5 筆寫死 → 動態從 `GENERATED.sessions` derive，加 `acFee`/`hasAircon`/`courtFee`/`court`/`maxSkillAllowed` 欄位<br>新增：`listPublicVenues()` / `getSlugByVenueId()` / `listSessionsByVenueAndDate()` / `listBookingDatesWithSessions()` / `getVenueBookingOverview()` / `getTimeslot()`<br>新增 16. 區段：`previewBatchSessionExpansion()` / `expandTimeslotToSessions()` / `createCustomSession()` |
| `data/store.ts` | `MUTABLE` 加 `sessions: Session[]`<br>`PersistedDiff` 加 `sessionsAdded` 通道<br>`emptyDiff()` / hydrate / `applyDiffToGenerated()` 全部同步<br>新增 `addSession(session)` mutation primitive |
| `data/permissions.ts` | `PageKey` 加 `'booking-overview'`、`PAGE_LABEL` / `PAGE_ACCESS_MATRIX` / `pathToPageKey()` 同步 |
| `app/layout.tsx` | 從直接 import Sidebar 改為用 `<ChromeShell>` 包 children |
| `app/book/[venue]/page.tsx` | 整個改寫（從場次清單變日曆首頁 + StatCard + 報名須知） |
| `app/book/confirmation/page.tsx` | 整個改寫（粉色化 + 三選付款顯示 + LINE 官方加好友提示） |
| `app/book/cancel/page.tsx` | 整個改寫（粉色化 + 三步驟查詢流程） |
| `app/audit/page.tsx` | `ACTION_STYLE` 加 `CREATE_SESSION` 配色 |
| `app/sessions/page.tsx` | 右上角加「+ 新增場次」按鈕（manager/owner 可點，staff disabled） |
| `components/Sidebar.tsx` | `ALL_LINKS` 加「報名熱度」項目（緊接場次管理之後） |

### 1.3 搬移的路徑

- `app/book/[venue]/[sessionId]/` 刪除 → 重建為 `app/book/[venue]/[date]/[sessionId]/`（路徑多一層日期）

## 2. 關鍵設計決策

### 2.1 報名頁完全獨立

報名頁的 mental model 是「未來部署到子網域」（例：`ace2.0.volleyops.tw`），現階段透過 path `/book/[slug]` 模擬。`ChromeShell` 在前端做視覺隔離（不顯示 ERP sidebar / impersonation banner / LayoutGuard）。

**部署 prod 子網域時要做**：
1. 加 Next.js middleware：把 `Host` header 反查回 slug
2. 改 BookingShell 內 Link 與 backHref 為相對路徑或子網域絕對 URL
3. 報名頁本可獨立打包成單獨 Next.js app（共用 `data/` + `types/`），這次 demo 沒拆

### 2.2 付款流程「永不串金流」

3 選付款方式（cash / linepay / transfer）皆為**現場結帳**。系統只在 Registration 寫 `paymentMethod` + `paidAt`，不串綠界 / 藍新 / TapPay / LINE Pay / 街口任何閘道。HANDOFF-stage11 中提到的「付款」TODO 在此階段確認為**永久 out-of-scope**。

### 2.3 冷氣費「另算」顯示

設計選擇 (B)：場次價是球費，冷氣費另算，頁面顯示「$280 + $50 冷氣（如有）」。
- `PublicSession.courtFee` = 球費
- `PublicSession.acFee` = 冷氣費（每位加收，0 = 此場沒設冷氣選項）
- `PublicSession.hasAircon` = `acFee > 0`（此場「有冷氣可開」）
- `PublicSession.acEnabled` = 此場館長已決定開冷氣（底層 Session.acEnabled）

### 2.4 LINE 登入「殼」

`components/booking/LineLoginModal.tsx`：
- `signInWithLine()` 為 mock — 點下去直接寫 fake user 到 `sessionStorage`
- 未來接真實 LINE Login 時：把 `signInWithLine()` 改成 OAuth redirect，加 `/api/auth/line/callback` route，sessionStorage key 維持不變

### 2.5 範本批量自動 skip

- 預覽顯示「該日已有相同 timeslot 場次」會自動 skip（連 cancelled 也算 — 取消的也佔位）
- 一次彙整成一筆 audit log（newValues 列出所有 sessionIds），避免 N 筆 spam

### 2.6 ERP「報名管理」已內建

階段 12 前，`/sessions/[id]` 詳情頁已有完整的報名管理（報名人 / 程度 / 報到 / 付款狀態 / 取消場次）。階段 12 不重做這部分；改做「更高層次」的 `/booking-overview` 看板，方便老闆/館長一眼看出未來兩週各館各日熱度。

## 3. 權限矩陣（階段 12 新加）

| Page | owner | manager | staff |
|---|---|---|---|
| `booking-overview` | full | own_venue | own_venue |
| `sessions/new`（無 pageKey，靠 button-level 控制） | ✓ | ✓ | disabled (button) |

`/sessions/new` 不在 PAGE_ACCESS_MATRIX，因為它 prefix-match 到 `sessions`，繼承 sessions 的權限（all role 都可進）。但內部 button 與「+ 新增場次」CTA 對 staff 做 `disabled` + tooltip。

## 4. 7 館 slug × LINE 官方帳號

| Slug | 館 | LINE 官方 |
|---|---|---|
| flywing | 飛翼 | `https://lin.ee/OUyU1V8` |
| ace2.0 | Ace 2.0 | `https://lin.ee/WoQsNoH` |
| ace3.0 | Ace 3.0 | `https://line.me/R/ti/p/@347cbbmr` |
| magicblock | 球魔方 2.0 | `https://lin.ee/Z6p1ypq3` |
| hibi | Hibi 日日 | `https://lin.ee/Haahm4QM` |
| playone | play one | `https://lin.ee/7ZXoZoP6` |
| smash | 就醬瘋 | `https://lin.ee/I9ghtiC` |

## 5. 已知 TODO / 未做的事

### 5.1 報名 mutation 落地

`/book/[venue]/[date]/[sessionId]` 的 `submit()` 目前是 mock（900ms delay → redirect 到 confirmation）。**沒有真的寫進 Registration**。

接 DB 時要做：
1. 在 `data/api.ts` 加 `createPublicRegistration({ lineUser, sessionId, payMethod, skills, ... })` mutation
2. 該 mutation 內部建 Customer + Registration，appendAuditLog `CREATE_REGISTRATION`
3. 把 `app/book/[venue]/[date]/[sessionId]/page.tsx` 的 `submit()` 改成 call 此 mutation

### 5.2 候補通知

候補機制目前 UI 完整（場次滿時 CTA 變「候補報名」、QS 帶 `waitlist=true`、confirmation 顯示「候補中」），但**沒有候補佇列 entity** 也**沒有通知機制**。未來要加：
- `WaitlistEntry` entity (sessionId, customerId, joinedAt)
- 當有報名取消時 → 取最早的 WaitlistEntry → 自動轉 Registration + LINE 通知

### 5.3 LINE 真實 OAuth

如 §2.4 所述，預留接口。

### 5.4 報名頁 prod 子網域化

如 §2.1 所述，要加 middleware。

### 5.5 `/booking-overview` 點場次行為

目前點任一場次列 → 跳轉到 `/sessions/[id]`。如果館長/老闆要「直接在看板上展開報名人 drawer」可以再做（成本中等）。

## 6. 編譯 check 命令

```bash
cd <repo>
npm install
npx tsc --noEmit 2>&1 \
  | grep -v "JSX.IntrinsicElements\|react/jsx-runtime\|Cannot find module 'next\|Cannot find module 'react\|Cannot find module 'next/server\|Cannot find name 'JSX'\|Cannot find name 'React'\|Cannot find namespace 'React'\|implicitly has an 'any' type\|Cannot find module 'tailwindcss'\|side-effect import" \
  | grep -E "error TS"
# ↑ 空白即代表 strict 零錯誤
```

更嚴格：
```bash
npx next build
# ↑ 成功表示所有頁面（含 server/client 邊界）都過
```

## 7. 凍結規則沿用

階段 7-11 的凍結規則維持：
- generator.ts seed 不動（種子 Sessions 維持 1486 場 / 17583 reg）
- 階段 12 透過 `MUTABLE.sessions.push()` + `PersistedDiff.sessionsAdded` 新增場次，與既有 `addRegistration` / `addPayment` 走同一個 pattern
- 階段 12 mutations 全部 write audit log（單一彙整 / 個別細項，視批量與否）

## 8. demo 用看點

1. **報名流程**：sidebar 點任一館（如「飛翼」）→ 月曆 → 選日期 → 看當日場次卡 → 點報名 → LINE 登入殼 → 填資料 → 三選付款 → 確認 → 確認頁
2. **粉色 vs 黑色配色切換**：sidebar 切到 `/sessions` 後再切到 `/book/flywing`，可看到 ERP chrome 完全消失（ChromeShell 作用）
3. **報名熱度看板**：sidebar 點「報名熱度」→ 切館 tab → 看 14 天彙整
4. **範本批量新增場次**：`/sessions` → 右上「+ 新增場次」→ Tab「範本批量」→ 選館 + 時段 + 4 週 → 預覽日期清單（已有的會 skip）→ 確認 → 看 audit log 一筆彙整紀錄
5. **單場手動新增場次**：同上但切到「單場手動」tab，可選 timeslot 帶入預設後微調，或完全自訂
6. **權限切換**：在 sidebar 切到 `u4 工讀生小明` 視角 → `/sessions/new` 入口的「新增場次」按鈕變 disabled + tooltip
