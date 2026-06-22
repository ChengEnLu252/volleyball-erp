# 🏐 VolleyOps — Claude Code 專案記憶

> **給 Claude Code**：每個 session 開始前先讀完這份。這是專案的 single source of truth。
> 標「🔒 已敲定」的決策**不要重新討論**；標「⚠️ 待定」的要先問使用者再動工。
> 工作時主動用工具（讀檔、bash、build 驗證），不要憑記憶猜。
> 使用者偏好：**動工大功能前先問清楚所有相關細節**（見最後一節）。

---

## 0. 現在的任務（最重要，先讀這段）

VolleyOps 已經做完一套**功能完整的 demo**（57 頁、stage 1～21），而且**接到正式案子了**。
現在的目標不是再加功能，而是 **把這套 demo 變成真正能運作、能上線收錢的系統**。

> ⚠️ 關鍵認知：目前看起來「很完整」，但**沒有真正的後端骨幹**——
> 資料是假的、登入是假的、寫入只存在瀏覽器。詳見第 4 節。
> 「讓它真的能運作」主要是 **換掉後端骨幹，不是重寫那 57 個頁面**。

---

## 1. 專案脈絡

**VolleyOps** — 多館連鎖排球場館 ERP，**7 個館**，要交付給館主正式營運。
- 技術棧：Next.js 16 + React 19 + TypeScript strict + Tailwind（裝了但全用 inline style）
- 7 個館：飛翼 / Ace 2.0 / Ace 3.0 / 球魔方 / Hibi 日日 / play one / 就醬瘋
- 對外：6+ 個館各自分開的報名網址；對內：ERP 整合

### 館主 9 條核心回饋（所有決策的根本，核心痛點：「我看不到錢的真實流向」）

1. 收費分**臨打費 / 冷氣費**，季打人員不繳
2. 各館分**冷熱門時段**（用於館長獎金計算）
3. **商品管理跨館庫存查詢**、調貨
4. **誠實商店**（投錢箱）的庫存與收入計算
5. 冷門場次無工讀生 → **客戶自助回報已付款**
6. 6 個館對外分開網址、對內 ERP 整合
7. **新增主揪權限**：館長以上層級授予
8. 系統算「**應收**」讓老闆對帳
9. 從 **Excel 對帳遷移到系統**

---

## 2. 業務模型（術語表，務必先懂）

| 術語 | 意義 |
|---|---|
| **時段 Timeslot** | 每週重複的某時段（例：飛翼週四 14-17） |
| **季 Season** | 12 週為一單位的營運區段 |
| **季租單 SeasonRental** | 主揪季初找 18 人包下時段一整季，季初一次收齊 |
| **季打人員 season_player** | 屬於某季租單，每場免費 |
| **臨打 walk_in** | 散客，每場現場付費 |
| **補位 season_substitute** | 季打請假時主揪找補位，付費邏輯同臨打 |
| **冷氣費 acFee** | 開冷氣加 20-30 元，**每場手動輸入、無預設值** |
| **主揪 captain** | 不是 User、不在權限系統；是某個 Customer + 一次性 accessToken |

---

## 3. 已建功能（demo 完成，不要重做）

| 範圍 | 內容 |
|---|---|
| 資料模型 | `types/index.ts` 為型別 source of truth；`prisma/schema.prisma`（558 行）已與型別對齊 |
| 客戶端報名 | 7 館共用報名頁、季租報名、確認/取消頁、報名熱度看板 |
| 場次 | 場次列表/明細/新增；應收帳自動計算（輸入場地費/冷氣費 × 人數 → 即時算應收） |
| 財務/對帳 | 退費鏈、付款、月記帳表、對帳系統（15 子頁已簡化為 5 入口）、異常清單、誠實商店、零用金、採購、年結 |
| 薪資 | 工讀生時薪 + 管理職薪資（依《旭日管理規章》PDF 計算，已整合原「館長績效」） |
| 商城 | 線上商城（ShopProduct + Order）+ 後台訂單管理 |
| 主揪 | captain token 公開頁（打卡、加臨打、自助回報） |
| AI | 獨立 AI 營運摘要頁 + 6 大分析模組（**目前是罐頭回覆**，見第 4 節） |
| 其他 | 館長週目標、通知收件匣、稽核 log、權限矩陣、登入閘門、側欄分類 |

---

## 4. ⚠️ 目前的「假骨幹」（這就是要替換的東西）

| 項目 | 現況 | 問題 |
|---|---|---|
| **資料** | `data/generator.ts`（seed=42）生假資料到記憶體 | 每次重載就重生，非持久 |
| **寫入** | 變更以 diff 存進**瀏覽器 localStorage**（`data/store.ts`） | 換裝置/換店員資料就對不上 → ERP 致命 |
| **登入** | 從清單挑 user、密碼沒驗證 | 假的，無 session、無雜湊 |
| **授權** | `data/permissions.ts` 權限矩陣**只在前端跑** | 可被繞過 |
| **資料庫** | `schema.prisma` 寫好但**沒接**（`package.json` 無 `@prisma/client`） | 純文件，未生效 |
| **AI** | `app/api/ai/route.ts` 寫死罐頭回覆 | 非真 AI |
| **憑證/通知/金流** | 上傳是假的、通知無真實管道、無金流 | 全未接 |

---

## 5. 🔒 已敲定的架構決策（不要重新討論）

1. **`data/api.ts` 是唯一資料入口** — 全部資料只從這裡進出。
   👉 **這是最值錢的設計**：換真 DB 時主要改 `api.ts` 內部，57 個頁面大多不用動。
2. **主揪 = Customer + token**（不動權限系統，用 `SeasonRental.accessToken`）。
3. **應收金額用算的**（動態 = walk_in/substitute 人數 ×（courtFee + acEnabled?acFee:0）），不存資料表。
4. **冷氣費無預設值**，每場手動輸入。
5. **Registration.type 三類**：season_player / season_substitute / walk_in。
6. **館長薪資依《旭日管理規章》計算**（已整合績效），不另外發明績效演算法。
7. 沿用現有 inline style + zh-TW。

---

## 6. 🎯 任務路線圖：demo → 上線

依賴順序排好（後面依賴前面）。每階段都能獨立交付、獨立驗證。

| 階段 | 內容 | 重點 / 風險 |
|---|---|---|
| **P0 決策** | 敲定主機、DB、真實使用者規模、Excel 遷移、金流/發票/個資合規 | 不寫 code，先鎖死（見第 7 節）。錯了後面全部重來 |
| **P1 真資料庫** | 接 Prisma → `api.ts` 內部改查 DB | **最大的工**：DB 查詢是 async，但 client component 現在用同步呼叫 → 要改成 server component / server action |
| **P2 真登入＋權限** | 密碼雜湊、session、後端強制授權、主揪 token 後端驗證＋過期 | 有寫入就必須知道「是誰在寫」 |
| **P3 真寫入** | localStorage 變更管線 → server action 寫 DB；稽核 log 落 DB | 系統才變成「多人多裝置一致」 |
| **P4 檔案＋通知** | 憑證上傳到物件儲存（S3/R2）、通知接真實管道（LINE/Email） | — |
| **P5 真整合** | 金流、發票、真 AI（接 Claude API）、Excel 匯入做遷移 | 屬外接，可獨立於核心之後 |
| **P6 上線硬化** | 環境變數/密鑰、備份、監控、錯誤處理、6 館對外部署、測試、教育訓練 | 真收錢系統不能省 |

### Claude Code 工作回合切法（每回合 = 一個可 commit、可驗證的小單元）

- **P1**：①裝 Prisma+DB、migrate、seed 初始資料 → ②挑一條線（如 dashboard）改查 DB＋改 server component，驗證模式 → ③用同模式把剩下的「讀」分頁遷完
- **P2**：④接真 auth＋雜湊＋session → ⑤權限矩陣搬後端、主揪 token 後端驗證
- **P3**：⑥寫入管線換 server action（先打卡、收款）→ ⑦其餘寫入＋稽核 log 落 DB
- **P4–P6**：各自 1～數回合，視範圍細切

> 量級參考：核心能運作（P1–P3）約 7 回合；做到能上線整體十幾～二十幾回合。

---

## 7. ⚠️ 待定：P0 動工前必須先問使用者

1. **主機 / DB**：DB 已定 **Supabase**（見第 12 節）。正式部署主機（前端）仍待定？
2. **使用者規模**：幾個館、各館幾個帳號、預估同時上線人數？
3. **Excel 遷移**：館主現有的 Excel 帳要不要匯入？格式？匯多久的歷史？
4. **金流**：要不要接線上金流（商城/收費）？哪一家？
5. **發票**：賣商品/收費要不要開電子發票（台灣）？
6. **個資 / 合規**：客戶個資、帳務的保存與安全要求？
7. **AI**：要真接 Claude API，還是先維持罐頭？

---

## 8. 📂 專案結構（關鍵檔案）

```
volleyops/
├── types/index.ts            ← 型別 source of truth（最大、最重要）
├── data/
│   ├── api.ts                ← 🔑 唯一資料入口（換 DB 主要動這裡）
│   ├── generator.ts          ← 假資料生成（seed=42）→ 未來改成 DB seed
│   ├── store.ts              ← localStorage 變更層 → 未來改成 server action 寫 DB
│   ├── permissions.ts        ← 權限矩陣（前端）→ 未來搬後端強制
│   ├── payroll.ts            ← 薪資引擎（依管理規章，計算邏輯不要動）
│   └── ledger.ts / *.ts      ← 對帳、誠實商店、零用金、採購等
├── prisma/schema.prisma      ← DB schema（已對齊型別，待接上）
├── app/                      ← 57 頁（route group (auth)、reconciliation/* 等）
│   └── api/ai/route.ts       ← 唯一 API route（罐頭 AI）
└── components/               ← Sidebar、LoginGate、RequireRole、AiSection 等
```

---

## 9. ⚙️ 環境注意事項

- **TypeScript strict**，path alias `@/*` → `./*`
- 全程 inline style（Tailwind 沒實際用）
- 跑 `npm install` 前，下列是 noise 不是真錯：`Cannot find module 'next'/'react'`、`JSX.IntrinsicElements`、`implicitly has an 'any' type` 等
- 驗證 build：`npx next build`（demo 階段 51 靜態頁全過）
- 假資料用 Mulberry32（seed=42）保證每次相同

---

## 10. 🛠️ 每個 session 的 SOP

1. 讀這份 `CLAUDE.md`，確認本回合屬於哪個階段（P0–P6 / 第 6 節哪個回合）
2. 用 **Plan mode** 先出計畫，給使用者看過再動手
3. 不要重做第 3 節「已建功能」、不要違反第 5 節「已敲定決策」
4. 改完跑 `npx next build`（或對應驗證）確認沒壞
5. 一個回合只交付一個可 commit 的單元，結束時簡短總結 + 下一步選項
6. 動到「新的大功能 / 待定決策」前，先問使用者（見第 7、11 節）

---

## 11. 👤 使用者偏好與溝通風格

- 🔑 **動工大功能前先問清楚所有相關細節**（最重要）
- 語言：**繁體中文**
- 風格：直接、有效率；喜歡「具體數字 + 故事連貫」；不喜歡冗長前言
- 願意一次處理大量資訊，給結構化清單/表格即可
- 交付：階段性、每個 milestone 收尾 + 提示下一步選項
- emoji 慣例：進度（✅ 完成、🚧 進行中、⏳ 待辦）、警示（⚠️、🎯、🔒、🚀）

---

## 12. 🚀 現在開工：Phase 1 範圍與「placeholder 換真」策略

### 簽約時程（重要前提）
- **下週才正式簽約**；簽約前對方**不提供任何敏感資訊**（客戶名單、收費、金流、帳號等）。
- 但案子已確定接 → **現在就開始建後端骨幹**，敏感資料用 placeholder，簽約後一鍵換真。

### Phase 1 範圍（對方指定，先做）
✅ **要先做、且要完美串接**：
- **報名系統**（場次列表 → 報名 → 確認/取消；季租報名）
- **權限系統**（真登入 + 後端強制授權，沿用既有 page×role 矩陣）
- **客戶名單**（CRUD + 查詢）
- **基礎頁面功能**（dashboard、場次、客戶等核心頁能用真資料跑通）

⏳ **Phase 2 再做**：商品管理、商城、比較複雜的財務/對帳/薪資。
> Phase 1 的頁面與資料流要與未來 Phase 2 無縫接上 → 一律走 `data/api.ts` 單一入口、schema 不為了 Phase 1 抄捷徑。

### 🔑 placeholder 換真 架構（這樣設計，資料一到直接填）
- **所有 client-specific 資料集中在一個檔**：`prisma/seed.ts`（或 `config/seed-data.ts`），
  以結構化陣列存 venues / users / customers / timeslots / seasons，每區塊上方標
  `// TODO[簽約後填真]：來源見 INFO-REQUEST.md §X`，placeholder 值用明顯假資料（例：`王測試`、`0900-000-000`）。
- **敏感連線/密鑰走環境變數**：`.env`（git 忽略）+ `.env.example`（提交、列出所有需填的 key）。
- **程式碼裡不寫死任何 client 資料** → 簽約後只動 `seed.ts` + `.env`，重跑 seed 即換成真資料。
- 缺的資訊**邊做邊記到 `INFO-REQUEST.md`**（專案根目錄），那是要跟對方索取的清單。

### 起步技術選型（🔒 DB 已敲定 Supabase）
- **DB：🔒 Supabase（託管 Postgres）**。dev 與正式皆用 Supabase，不用本機 Docker。
  - Prisma 連 Supabase 要兩條連線：app 用 **pooled**（`DATABASE_URL`），migration 用 **direct**（`DIRECT_URL`）。搞錯會 migrate 失敗。
  - **現階段 Supabase 只當 Postgres 用**；其自帶的 Auth / Storage 暫不使用（Storage 留待 P4 憑證上傳時再評估）。
- Auth：**Auth.js（NextAuth）** email+password + 雜湊，snap 進既有 LoginGate / 權限矩陣（不改用 Supabase Auth）。

### 待對方提供的資訊
→ 見專案根目錄 **`INFO-REQUEST.md`**（已分類、標好「現在可給 / 簽約後」）。

---

**結束。Claude Code 讀到這裡就可以開始第 10 節的 SOP。**
