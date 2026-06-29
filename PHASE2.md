# 🏐 多爾森健康 ERP — Phase 2 規劃

> Phase 1（Round 1–10）已完成：Supabase + 真登入/權限 + 報名/客戶/場次/季租對帳/dashboard/主揪 全上真資料庫。
> Phase 2 = 把仍跑 store 假資料的「財務/對帳/薪資、商品/商城」接真 + 四個外接整合。
> 做法延續 Phase 1：`data/server/queries.ts`（讀，server-only）+ `app/actions/*`（寫，後端授權）+ server 殼。

---

## 本次敲定的方向（決策）
- **優先順序**：財務 / 對帳 / 薪資 **先做**（直擊館主核心痛點「看不到錢的真實流向」）。
- **金流 / 電子發票**：這階段**先不接**，維持現場付款（現金/轉帳/LINE Pay）的「記錄」。日後再評估。
- **外接整合（本階段納入）**：真 LINE 登入、真 AI 摘要、Excel 匯入歷史帳、通知管道（LINE/Email）。
- 🔒 **冷氣費算法（依對方實務敲定）**：分兩層——
  (1) **向玩家加收**的冷氣費＝現有 per-session `acFee`（收款這層不變）；
  (2) **電表成本**＝「**度數 × 8 元/度**」（play one；各館單價待確認），用來與實收對「**盤損**」。
  → (2) 在 **P2.2 對帳** 實作：`Session` 加冷氣度數欄、各館加電費單價；不影響 P2.1 收款。
- 🔒 **冷門時段各館自訂**（play one：9-19、22-01）→ `Timeslot` 加冷/熱門旗標，餵館長獎金（P2.3）。
- 參考：對方真實記帳 Excel 結構與對應見 `client-data/欄位對應表.md`（gitignored）。

---

## ⚠️ Phase 2 的隱形大工：補 schema
Phase 1 只把「核心實體」入了 DB。以下目前仍只存在 `data/store.ts` 的記憶體 / PersistedDiff，**Prisma schema 沒有對應表**，每個區塊遷移＝先補 Prisma 表 + migration + seed，再做 server 殼/action：

`Payment 收款流程`、`weeklyGoal 館長目標`、`appNotification 通知`、`ledgerDay 月記帳`、
`partTimerSheet/managerSalary 薪資`、`procurementRequest 採購`、`pettyCashEntry 零用金`、
`order/shopProduct/productTransfer 商城`、`boxAudit 誠實商店`、`uploadedEvidence 憑證`、`competitionPlan`。

> 註：`Payment` 表在 schema **已存在**（Phase 1 seed 有灌），但「**新增收款**」的寫入流程還沒做（目前收款只在 store mutate）。P2.1 要把收款寫入接到既有 Payment 表。

---

## 子階段（依序，每個可獨立交付 / commit）

### P2.1 收款 / 付款基礎（最先做）
對帳、報表、薪資都依賴真實 Payment 資料，所以先打地基。**不依賴任何外部帳號。**

- ✅ **P2.1a 場次明細收款（已完成，本回合）**：`app/actions/payments.ts` 新增
  `collectPaymentAction`（建 `status='paid'` Payment + `ADD_PAYMENT` AuditLog；金額 =
  courtFee+acEnabled?acFee；季打排除；transaction 防雙擊重複收款；授權＝登入+venue scope）
  與 `undoPaymentAction`（誤收時刪 paid Payment + `UPDATE_PAYMENT`；擋已退費）。
  `app/sessions/[id]/SessionDetailClient.tsx` 名單加「收款」欄（付款方式下拉＋收款鈕／取消收款鈕）。
  讀取側 `getSessionDetailForUserAsync` 既有 paymentStatus/expectedAmount，無需改。build 綠＋唯讀探針驗過。
- ✅ **P2.1b checkin 報到頁收款（已完成）**：`app/checkin/page.tsx` 改 server 殼（`getCheckinDataForUserAsync`
  查當日／最近有場次的日子、依 venue scope）；`CheckinClient.tsx`（新）報到走 `setAttendanceAction`
  （`app/actions/checkin.ts`，attendance 不寫 audit）、收款走 `collectPaymentAction`、取消收款 `undoPaymentAction`。
  原 `markPaid()`/`toggleCheckin()` 純本地 state 退役。當日多場可切換。build 綠。
- ✅ **P2.1c 自助回報確認入帳（已完成）**：
  - 客戶端 `app/self-checkin/[sessionId]` 改 server 殼（`getSelfCheckinDataAsync`，公開、僅無人場次）+
    `SelfCheckinClient`（新）；「我已付款」→ `reportSelfPaymentAction`（`app/actions/self-checkin.ts`，
    只寫 `Registration.selfReported*`、**不建 Payment**、樂觀鎖、SELF_PAYMENT_REPORT audit）。
  - `components/ChromeShell.tsx`：`/self-checkin/` 加公開白名單（否則客戶被 LoginGate 擋）。
  - 後台「確認入帳」：`SessionRegRow` 加 `selfReportedPaid`/`selfPaymentMethod`，場次明細未付款列顯示
    「🙋 已自助回報」、按鈕變「確認入帳」並預帶客戶回報的付款方式 → 走既有 `collectPaymentAction` 建真 Payment。
  - build 綠 + 唯讀探針（無人場次 `s-ts90` @ Hibi）。
- ✅ **P2.1d 退費鏈（已完成）**：
  - migration `20260629120000_refund_chain`：`Registration.refundDecision`（RefundDecision enum nullable）+
    `AuditAction` 加 `ISSUE_REFUND`/`WAIVE_REFUND`（已套用 Supabase）。
  - `app/actions/refunds.ts`（新）：`issueRefundAction`（開負額 Payment status=refunded + refundDecision='refunded'
    + ISSUE_REFUND audit；owner/manager + venue scope + 樂觀鎖 + 金額 0<x≤netPaid）、
    `waiveRefundAction`（只標 refundDecision='waived' + WAIVE_REFUND audit，不建 Payment）。
  - `queries.ts`：`getPendingRefundsForUserAsync`（已取消場次 + refundDecision=null + netPaid>0；取消時間/原因由
    CANCEL_SESSION audit 推導）、`getRefundHistoryForUserAsync`（退費後設資料由負額 Payment + audit 推導，不另存欄位）。
  - `finance/refunds` 改 server 殼 + `RefundsClient`（新，待退費/歷史兩分頁，前端篩選，樂觀鎖+ConflictBanner）。
  - build 綠。測試：先收款→取消場次→退費頁出現待退費（seed 目前無已取消場次）。
- ⏳ **P2.1e 場次收款對帳**：`reconciliation/sessions` 讀取殼（每場應收/實收/差額由 DB 計）。

### P2.2 對帳系統 hub
- 月記帳 `reconciliation/ledger`(+`/review`)、報表匯出 `finance/payments`、財務報表 `finance`、
  異常清單 `reconciliation/anomalies`、無人場次 `reconciliation/unattended`、誠實商店 `reconciliation/honest-shop`。
- 讀取殼 + 記帳 upsert server action；異常改由 DB 計算。
- 需補表：`ledgerDay`、`boxAudit`（誠實商店）。

### P2.3 薪資 / 績效
- 工讀生時薪、管理職薪資（**`data/payroll.ts` 計算邏輯不動**，依《旭日管理規章》，只改吃 DB 資料）、
  館長週目標(`goals` 讀 + 提交/確認 server action)。
- 需補表：`partTimerSheet`、`managerSalary`、`weeklyGoal`、`appNotification`。

### P2.4 商品 / 商城（財務鏈完成後）
- 跨館庫存查詢 / 調貨(`products` + `products/transfers`)、線上商城(`shop/*`)、後台訂單(`orders`)、誠實商店庫存。
- 需補表：`shopProduct`、`order`、`productTransfer`。

### P2.5 外接整合（可與上面並行）
- **真 LINE 登入**：LINE OAuth 接客戶報名端（取代 `components/booking/LineLoginModal` 的 mock）。
  - 🔒 **架構：對外 7 套各自獨立、對內整合**。老闆要藏身 → 客戶眼中是 7 間互不相干的球館：
    - **每館 1 個 LINE Login channel ×7**（登入畫面顯示「該館」品牌；最好各自獨立 Provider，連 LINE 後台層級都不互相露出關聯）。
    - **每館 1 個官方帳號（Messaging API）×7**（見下方通知管道，發該館自己的成功通知）。
  - ⚠️ **LINE userId 不能跨 channel 串**（LINE 隱私設計：同一人在不同 channel 登入拿到不同 userId）→ **不能**用 LINE 帳號把同一人 7 館報名串起來；剛好也保護藏身。
  - 🔑 **後台客戶整合 = 手機號 + 姓名雙重比對**（不是 LINE）：
    - 手機號 **且** 姓名皆同 → 判定同一人，自動併入同一客戶檔（老闆看到 7 館整合的全部報名紀錄）。
    - 手機號同、姓名不同 → 跳既有三選一對話框（用舊／覆蓋／都新增），防「一號多人」誤併。
    - 沿用並收緊現有報名自動建檔去重邏輯（見 `data/server` 報名 action）。
  - LINE 在這裡只負責「**該館的登入身分** + **該館官方帳號發通知的 userId**」；真正的客戶身分鑰匙是手機號＋姓名。
- **真 AI 摘要**：`app/api/ai/route.ts` 接 Claude API（用最新 Claude 模型），dashboard / `ai-summary` 罐頭換真。
- **Excel 匯入**：上傳 → 解析 → 欄位對應 → 批量 upsert（客戶 + 歷史帳）。
- **通知管道**：收件匣事件 → 真 LINE（Messaging API）/ Email 發送。每館用**自己的官方帳號**發（報名飛翼 → 飛翼官方帳號回成功通知）。

---

## 待對方 / 你提供（外接前置卡點）
| 項目 | 需要 |
|---|---|
| 真 LINE 登入 | **7 組** Login channel 的 Channel ID / Secret（每館一組）＋ 各館 callback 網域；最好各館各自獨立 Provider |
| 真 AI | Claude API key（放 Vercel 環境變數，勿入版控） |
| Excel 匯入 | 館主現有 Excel **範例檔 + 欄位說明**（客戶、歷史帳） |
| 通知管道 | **7 個**官方帳號（Messaging API）access token（每館一個）；或 Email SMTP 帳號 |
| 收費規則 | 各時段球費、冷氣費規則（影響應收/對帳數字；簽約後） |

> 📌 **為什麼登入要 7 組憑證、又不能用 LINE 串客戶？**
> Channel ID/Secret = 該館報名頁向 LINE「表明身分」的帳密，LINE 才肯把登入者的姓名/userId 回傳給該館。
> LINE 故意讓 userId **不能跨 channel/品牌串**（隱私設計）→ 所以 7 館各自一組憑證、各自獨立品牌（老闆藏身），
> 後台改用**手機號＋姓名**把同一人的跨館報名併成一個客戶檔。對外 7 間互不相干，對內統一整合。

---

## 量級與原則
- 比 Phase 1 大（補很多 schema + 外接），但仍維持「每回合一個可 commit、可驗證的小單元、build 綠」。
- 驗證沿用：build 綠 + 唯讀探針 + authed SSR 200 + 使用者瀏覽器實測（**不對正式 DB 跑寫入探針**）。
- 不破壞既有頁：未遷區塊繼續走 store，遷一塊退一塊。

## 建議起手
**P2.1 第一回合：收款 server action**（把「收錢」變真）—— 財務鏈地基、零外部依賴。
