# VolleyOps — 排球場館整合管理系統

## 啟動開發環境

```bash
npm install
npm run dev
```

瀏覽器打開 http://localhost:3000

## 資料夾說明

| 路徑 | 用途 |
|---|---|
| app/dashboard | 老闆總覽 Dashboard |
| app/sessions | 場次管理 + 報名名單 |
| app/checkin | 工讀生前台（報到/收款）|
| app/customers | 客戶資料 + 程度標籤 |
| app/products | 商品管理 + 庫存 |
| app/finance | 財務報表 |
| app/audit | 操作紀錄 Audit Log |
| app/api | 後端 API（上線後對接資料庫）|
| types/index.ts | 全系統 TypeScript 型別 |
| data/mock.ts | Demo 假資料（上線前用）|
| lib/utils.ts | 共用工具函式 |
| components | 可重複使用的 UI 元件 |

## Demo → 正式上線

所有 `data/mock.ts` 裡的 function（`getDashboard`, `getSessions` 等）
只需換成 `fetch('/api/...')` 即完成串接，頁面程式碼不用改。
