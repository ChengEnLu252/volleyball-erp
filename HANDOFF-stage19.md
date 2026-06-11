# HANDOFF — 階段 19：員工薪資計算

## 一、需求
新增員工薪資計算頁面。業主有兩套薪資制度：
- **工讀生**：時薪制（正常薪水 = 時數 × 時薪；總薪水 = 正常薪水 + 獎金 − 罰款），另算薪資佔營收比例。
- **管理職**：本職薪 + 美編 + 各項獎金 − 勞健保自付 − 請假（= 月薪 ÷ 30 × 天數）。

## 二、業主確認的範圍（本階段 ask 結果）
1. 兩種薪資都做（管理職 + 工讀生）。
2. 能自動的盡量從系統帶（冷門場次、營收），其餘手動。
3. 示範資料用規章圖中的人（工讀生 13 人、管理職林口館主）。

## 三、規章資料來源（業主提供照片，非文字檔）
> craft.do 規章為前端動態渲染 + 非可連網域，無法程式擷取；改以業主照片為準。

**冷門場次獎金 / 罰則**（每館）：
- 林口（=v2）：開團 ≥10 → 1,000；≥15 → 3,000；<2 → 罰 1,000。
- 其他場館：開團 ≥24 → 1,000；≥36 → 3,000；<5 → 罰 1,000。
- 冷門 = 場次所屬 Timeslot.isHotZone===false；開團 = 場次 status≠'cancelled'。

**年終獎金 2026**（每館，級距獎金一致、100% 月營收基準不同）：
- 90%→3,000、100%→30,000、105%→60,000、110%→90,000。
- 各館 100% 月營收：林口 275,000 / 八德 283,333 / 內壢 291,667 / 五股 350,000 / 飛翼 366,667 / 新竹 200,000。
- 年度目標 = 基準 × 12；達成率 = 系統年度實收 ÷ 年度目標。

**場館對應**（規章名 ↔ demo venueId，依行政區）：
林口=v2、八德=v5、內壢=v4、五股=v1、飛翼=v3、新竹=v6。（v7 Ace 3.0 不在規章表內，套「其他」規則、無年終表。）

**工讀生等級預設時薪**：小幫手 190 / 主揪小幫手 195 / 資深小幫手 200 / 主揪資深小幫手 220 / 主揪×2 210。
⚠️ 規章圖「資深小幫手」同時出現 200 與 195 → 時薪以**每人**為準（每列可覆寫），等級值僅為新列預設。

## 四、進度
- ✅ **Milestone 1（本次）**：資料層（型別 + 計算引擎 + 持久化）+ 工讀生時薪表頁面。
- ⏳ **Milestone 2（下次）**：管理職薪資頁面（消費既有引擎：自動冷門獎金 + 年終獎金進度 + 請假扣薪）。

## 五、檔案異動
新增：
- `data/payroll.ts` — 計算引擎 + 規章常數 + 自動取數 + 讀取。
  - 常數：`OFFPEAK_RULE_LINKOU/OTHER`、`getOffPeakRule`、`YEAR_END_2026`、`getYearEndConfig`。
  - 自動取數：`getSystemMonthlyVenueRevenue`、`getSystemAnnualVenueRevenue`、`countOffPeakOpenedSessions`。
  - 計算：`computePartTimerRow/Sheet`、`computeOffPeakBonus`、`computeYearEndBonus`、`computeManagerSalary`。
  - 讀取：`getPartTimerSheet`、`getManagerSalaries`、`defaultRateForLevel`、`currentMonth`。
- `app/reconciliation/payroll/page.tsx` — 工讀生時薪表（每館每月一張，可編輯、自動算比例）。

修改：
- `types/index.ts` — 階段 19 區塊：`StaffLevel`(+LABEL/DEFAULT_RATE)、`PartTimerRow`、`PartTimerPayrollSheet`、`ManagerLineItem`、`ManagerSalaryRecord`、`OffPeakBonusRule`、`YearEndBonusTier`、`YearEndBonusConfig`。
- `data/store.ts` — `PART_TIMER_SHEETS`/`MANAGER_SALARIES`（含種子）、`getAllPartTimerSheets`/`getAllManagerSalaries`、`PersistedDiff.partTimerSheetsUpserts`/`managerSalariesUpserts`（emptyDiff/hydrate/applyDiff 同步）、`upsertPartTimerSheet`/`upsertManagerSalary`。
- `app/reconciliation/page.tsx` — 對帳首頁新增「工讀生時薪」入口。

## 六、與既有架構銜接
- 持久化沿用 localStorage diff 模式（key `volleyops-stage3prod-v1`）。工讀生表鍵 `${venueId}:${month}`、管理職鍵 record.id，皆 upsert。
- 權限沿用 `reconciliation` page key（owner full、manager own_venue）；頁內以 `getEffectiveRole` gate（owner/manager 可編輯，餘唯讀）。
- 球館範圍用 `getCurrentVisibleVenueIds`；營收重用 `getMonthlyReconciliation('month').totalActual`。
- UI 重用 `components/reconciliation/Common`（ReconHeader/StatCard/Panel/Money）。

## 七、驗證
- 引擎公式對照規章圖：工讀生本月薪水 = **24,745 ✓**、比例 = **8.69% ✓**；冷門獎金級距、年終目標、請假扣薪（35000/30×2=2,333）皆正確。
- `tsc --noEmit`：payroll.ts / store.ts / types / 新頁面 / reconciliation 首頁 **0 error**（其餘檔案的 key-prop/null 錯誤為本機無 node_modules 的環境 noise，stage18 即存在）。

## 八、操作驗證建議
1. 館長（u2 / u3，密碼 0000）或老闆（u1）登入 → 對帳系統 → 工讀生時薪。
2. 選林口（v2）→ 看到 13 人種子、本月薪水 24,745、比例自動算。
3. 改時數/獎金/罰款 → 數字即時更新 → 儲存 → 重整仍在。
4. 切其他館 → 空表，可「+ 新增一列」自行建立。

## 九、Milestone 2 待辦（管理職頁面）
- 新增 `app/reconciliation/payroll/manager/page.tsx`：
  - 表單：本職薪、美編、手動獎金條目（中秋/跨館輔導…）、勞健保、請假天數、手動扣款。
  - 自動面板：冷門場次獎金（`computeOffPeakBonus` + 開團數）、年終獎金進度（`computeYearEndBonus`，年度達成率 → 投影年終）。
  - 結算：`computeManagerSalary` → 收入合計 / 扣款合計 / 實領。
  - 對帳首頁加「管理職薪資」入口。
- 引擎已就緒，Milestone 2 主要是 UI。
