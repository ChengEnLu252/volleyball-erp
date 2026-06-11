# HANDOFF — 階段 20 · Milestone 1：對齊「旭日管理規章」正文（薪獎引擎 + 冷熱門）

> 本階段起因：業主補提供完整《管理規章》PDF（9 頁）。逐條與 demo 核對後，
> 動工修補。M1 聚焦「館長/工讀生實拿金額」相關、且互相耦合的四項。

## 一、規章核對結論（先講已驗證對上的）
用規章正文重新核對階段 19 的薪獎常數（原本依照片建立），**全部一致**：
- 冷門場次達標獎/罰：林口 10→1000・15→3000・<2 罰1000；其他 24→1000・36→3000・<5 罰1000 ✓
- 2026(115) 年終各館 100% 目標與級距（90→3k/100→30k/105→60k/110→90k）✓
- 請假扣薪 = 月薪÷30×天 ✓
- 年終營收基準「含冷氣、商品」：`totalActual` 已含 session payment(冷氣)+productRevenue ✓（不需改）

**新發現**：規章 6-1 低標的「新莊」＝飛翼(v3，地址新莊區)，非筆誤；新竹＝就醬瘋(v6)。

## 二、M1 完成項目（4）
### 1. 🔧 冷熱門定義對齊規章（generator）
- `slotHotness` 改為 venueId-aware，依規章 6-2：
  - 一般館：平日 19-22(slot3) 熱、平日其餘冷、假日(無22後場次)全熱。
  - 新竹(v6) 特例：熱門 = 平日19-22 ＆ 六日12-18(slot1/2)，其餘冷。
- 球費(`slotFee`)抽出、維持原值，不動營收。
- ⚠️ 連鎖影響：冷門場次數下降、`venueRevenueDelta` 改變 → **故事點1（球魔方 revenue_drop）原為 -46% critical 掉到 -22% warning**。
  已調整 v1 近 7 天 skip（冷門 0.85、熱門 0.55）**救回 -46% critical** ✓，且原本飛翼雜訊消失。

### 2. 🥇 冷門「時段營收」分潤獎金 20/10/5%（規章 6-2，原本完全沒做）
- `data/payroll.ts` 新增：
  - `OPERATING_FLOOR`（月營收低標，規章 6-1；v6/v7 規章未列暫設、待業主確認）+ `getOperatingFloor`
  - `getHotZoneOpenStatus`（熱門場次是否全開）
  - `getOffPeakCourtRevenue`（冷門純場地費，依場地費佔比剝離冷氣）
  - `computeOffPeakRevenueBonus`：低標未達→5%；否則熱門全開→20%、未全開→10%
  - 併入 `computeManagerSalary`（`offPeakRevenue`，計入 grossIncome）
- 管理職頁面新增分潤面板（20/10/5% 標色 + 計算明細）。
- **驗證（本月）**：球魔方月營收199k<低標210k→5%＝2,256（與其營收驟降故事呼應）；
  其他館熱門全開→20%（林口館主 +15,648 → 實領 51,315）。

### 3. 🥉 工讀生薪資比例超標標紅 + 罰款（規章 6-3 成本控管）
- `data/payroll.ts`：`WAGE_RATIO_LIMIT_DEFAULT`(0.11)/`_HSINCHU`(0.12)/`WAGE_RATIO_PENALTY`(1000)；
  `computePartTimerSheet` 回傳 `ratioLimit`/`overLimit`/`wageRatioPenalty`。
- 工讀生頁面：比例 StatCard 超標轉紅 + 警示橫幅 + 罰款金額。
- 驗證：林口 v2 比例 8.69% < 11% → 未超標 ✓（與階段19驗證值一致）。

### 4. 🥈 報表繳交追蹤 + 逾期罰款（規章 3-2 / 6-3）— 已完成
- `types/index.ts` 新增：`ReportType`/`ReportDef`/`REPORT_DEFS`（合併 3-2 與 6-3 兩表）/
  `REPORT_LATE_PENALTY`(500)/`ReportSubmission`/`ReportStatusKind`。
- `data/reports.ts`（新檔）：`classifyReport`（準時/遲交/待繳/逾期未繳）、
  `getVenueReportSummary`、`getAllVenueReportSummaries`；逾期一項罰 500。
- `data/store.ts`：`REPORT_SUBMISSIONS` 種子 + `getAllReportSubmissions` +
  `upsertReportSubmission` + `reportSubmissionsUpserts` 持久化。
- `app/reconciliation/reports/page.tsx`（新頁）：月份切換、全公司逾期項數/罰款/準時率、
  各館 7 報表狀態色標 + 一鍵「標記今日繳交」。對帳首頁加入口。
- **驗證（本月 6/9）**：球魔方 薪資明細遲交+零用金未繳→$1000；內壢/八德各遲交一項→$500；
  新竹 存款回報未繳→$1000；Ace3.0 多項未繳→$2000；全公司逾期罰款合計 $5,000。

## 三、檔案異動
- `data/generator.ts`：`slotFee`(新)、`slotHotness`(改 venueId-aware)、v1 近期 skip 調整。
- `data/payroll.ts`：低標/比例常數 + `getHotZoneOpenStatus`/`getOffPeakCourtRevenue`/`computeOffPeakRevenueBonus`；
  `PartTimerSheetComputed`/`computePartTimerSheet`、`ManagerSalaryComputed`/`computeManagerSalary` 擴充。
- `app/reconciliation/payroll/manager/page.tsx`：冷門分潤面板 + subtitle。
- `app/reconciliation/payroll/page.tsx`：比例超標標紅 + 警示橫幅。

## 四、驗證方式（重要：本環境可實跑！）
- Node 22 可用 `--experimental-strip-types` 直接執行資料層（無需 node_modules）。
- 解析 @/ 與相對 import 需 loader hook（見 /tmp/hook.mjs 範式）+ react stub。
- `tsc --noEmit`：資料層(payroll/generator/store/types) 0 real error；
  其餘 56 個 `key`-prop / children:any[] 為本機無 @types/react 之 noise（遍布未動檔案，stage18 即存在）。

## 五、剩餘待辦（4 項次要，下一輪）
1. 記帳表異常罰則偵測（匯款少/多匯100、負帳未填500、營收漏填100）— 擴充 anomalies。
2. 採購/修繕分級簽核流程（2000/5000 級距 + 修繕單 + 完工拍照接 evidence）。
3. 零用金台帳 + 年度6萬上限 + 超支扣年終5000（接既有年終引擎）。
4. 比賽企劃追蹤（每館≥3場、新竹+內壢共4、未達扣年終3000）。

## 六、待業主確認（規章未涵蓋/疑義）
- v6(新竹)/v7(Ace3.0) 之營運低標數值（6-1 表未列）。
- 工讀生等級時薪表在另一份《工讀生守則》，本 PDF 無 → 無法核對 190/195/200/220/210。
- 冷門分潤 10%（熱門未全開）情境：目前種子各館熱門皆全開，故只看得到 20%/5%；引擎已支援 10%。
