# HANDOFF — 階段 19 · Milestone 2：管理職薪資頁面（完成）

## 一、本次完成
Milestone 2（UI）。引擎於 M1 已就緒並驗證，本次僅消費既有引擎、無新增計算邏輯。

## 二、檔案異動
新增：
- `app/reconciliation/payroll/manager/page.tsx` — 管理職薪資頁面。
  - 球館 / 月份選擇（沿用 M1 的 `recentMonths` 與權限/可視館範圍）。
  - 每位管理職一張卡：姓名、本職月薪、美編、勞健保自付、請假天數（即時顯示扣薪 = 月薪÷30×天）、
    額外獎金條目（中秋／跨館輔導…）、其他扣款條目、冷門場次獎金自動開關。
  - 自動面板：
    - 冷門場次獎金 — `computeOffPeakBonus` + `countOffPeakOpenedSessions`（卡內顯示獎金／罰款）。
    - 年終獎金進度 — `computeYearEndBonus`，年度達成率進度條 + 級距 chips + 投影年終
      （年終為年度結算項目，明示不計入本月實領）。
  - 結算：`computeManagerSalary` → 收入合計 / 扣款合計 / 實領。
  - 「+ 新增管理職」可加列；未持久化的新草稿可移除。

修改：
- `app/reconciliation/page.tsx` — 對帳首頁新增「管理職薪資」入口
  （置於「工讀生時薪」與「異常清單」之間）。

## 三、設計決策（記錄）
- 型別與 store 為 list-based（`getManagerSalaries` 回陣列、鍵 = `record.id`、每人每月一筆），
  故頁面支援「同館同月多位管理職」之新增／編輯，比照 M1 工讀生表多列模式。
- store 僅提供 upsert（無 hard-delete）。因此「移除」僅對尚未存檔的新草稿生效；
  已持久化紀錄不提供硬刪除，以免破壞 diff／持久化模式。若日後需刪除，
  應另於 `data/store.ts` 補 `deleteManagerSalary` 並同步 `PersistedDiff`。

## 四、驗證
- `tsc --noEmit`：全專案 **0 error**。
- `next build`：成功；新路由 `/reconciliation/payroll/manager` 已列入並靜態預渲染。
- 請假扣薪對照規章圖：35000 ÷ 30 × 2 = **2,333 ✓**（`Math.round`）。

## 五、操作驗證建議
1. 館長（u2／u3，密碼 0000）或老闆（u1）登入 → 對帳系統 → 管理職薪資。
2. 選林口（v2）→ 看到種子「林口Ace 館主」，本職 35,000、請假 2 天（扣 2,333）、冷門獎金自動帶入。
3. 改本職／獎金／扣款 → 收入合計／扣款合計／實領即時更新。
4. 年終面板顯示 v2 之年度達成率與投影年終；切到 v7（Ace 3.0）→ 顯示「無年終獎金表」。
5. 「+ 新增管理職」加一列 → 儲存 → 重整仍在（localStorage diff）。
