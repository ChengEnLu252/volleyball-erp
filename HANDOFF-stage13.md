# 階段 13 — 排球館報名系統視覺整合

## 任務目標
將舊飛翼報名系統的 UI 風格（截圖參考）整合進新 Next.js + TS ERP 的客戶端報名頁，
所有 7 個館（飛翼 / Ace 2.0 / Ace 3.0 / 球魔方 / Hibi / play one / 就醬瘋）共用。

## 用戶確認的決策（不要再改）
1. **流程保留兩步**：`/book/[venue]` 月曆 → `/book/[venue]/[date]` 場次清單。只套舊版視覺。
2. **規則文字 7 館共用**：飛翼那套（球場守則 / 報名須知 / 取消候補 / 包場 / 公務損壞 / 停車）。
3. **LINE 登入閘門**：規則區可看，日曆/場次/我的預定需登入。
4. **我的預定要做**：未來場次（可取消）+ 歷史報名（唯讀）。
5. **場次卡**：時間軸 layout + 舊版簡潔文字 + 保留程度 tooltip 與冷氣 tag。
6. **包場**：場次列表混排 + 規則區「包場價格」展開區連到既有 `/book/rental`。
7. **LINE 官方帳號**：每館用既有 `lineOfficialUrl`。
8. **LINE 社群**：每館加 `lineCommunityUrl` 欄位，全部預設空字串（用戶未來整理）。
9. **「我的元素」**：粉紅可愛運動風 + 「我的預訂」功能 + 歷史報名場次。

## 改動檔案清單

### 新增
- `data/my-bookings.ts` — 用 sessionStorage 持久化「我的預定」資料；
  公開 `listMyBookings` / `listUpcomingBookings` / `listHistoryBookings` /
  `addMyBooking` / `cancelMyBooking` / `canCancelBooking` / `seedDemoHistoryIfNeeded` / `clearMyBookings`
- `components/booking/rules-content.tsx` — 6 章規則文字模組（飛翼版，7 館共用）
- `components/booking/RulesSection.tsx` — 摺疊規則區，預設全收合
- `components/booking/BookingHeader.tsx` — 新版 sticky bar（Logo + tab + 登入鈕）
- `components/booking/LoginGate.tsx` — 登入閘門元件（模糊預覽 + 中央 CTA）
- `app/book/[venue]/me/page.tsx` — 我的預定頁（即將 / 歷史 子 tab）

### 修改
- `data/api.ts` — `PublicVenueInfo` 加 `lineCommunityUrl: string` 欄位（全 7 館空字串）
- `components/booking/LineLoginModal.tsx` — mock user ID 改成固定 `mock-line-demo-user`；
  登入時自動 seed 3 筆歷史 demo 報名
- `components/booking/theme.ts` — 加 `pinkVivid` / `pinkVividDeep` 強化粉
- `components/booking/BookingShell.tsx` — 改用新的 BookingHeader；
  移除舊 Hero 大標和 CompactBar；保留 Footer；`hero` / `backHref` props 標記 @deprecated 但保留向後相容
- `components/booking/SessionCard.tsx` — 改成時間軸 layout（左圓點 + 右卡片）；
  簡化文字（招募 N 人 / 費用 / 已報名候補）；保留程度 tooltip + 冷氣 tag
- `app/book/[venue]/page.tsx` — 規則區（always visible）+ 統計概覽 + 日曆（LoginGate 包住）
- `app/book/[venue]/[date]/page.tsx` — 日期標題卡 + 場次列表（LoginGate 包住）
- `app/book/[venue]/[date]/[sessionId]/page.tsx` — 報名 submit 成功後寫入 my-bookings

## 未來真實 LINE OAuth 整合 hand-off 點

當實際串 LINE Login OAuth 時，只需改 **3 個地方**，下游頁面零修改：

1. **`components/booking/LineLoginModal.tsx`** 的 `signInWithLine()`：
   - 把 `setTimeout` 的 mock 換成真實的 LINE OAuth redirect flow
   - 取得真實 `userId` / `displayName` / `pictureUrl`
   - 保留 `seedDemoHistoryIfNeeded()` 呼叫（或視需求拿掉）

2. **`data/my-bookings.ts`** 的 storage 層：
   - sessionStorage 換成 fetch 後端 API（`GET /api/me/bookings`、`POST /api/me/bookings`、`DELETE /api/me/bookings/:id`）
   - 函式 signature 維持不變

3. **`data/api.ts`** 的 `lineCommunityUrl`：
   - 整理 7 館 LINE 社群網址後填入即可

## TypeScript / Build 狀態
- ✅ `npx tsc --noEmit` 通過
- ✅ `npx next build` 通過
- 新路由 `/book/[venue]/me` 已被識別

## Demo 體驗順序建議
1. 訪問 `http://localhost:3000/book/flywing`
2. 看到規則區 6 個摺疊（預設收合，可展開）
3. 滾下去看到統計卡 + 日曆閘門（模糊背景 + 「使用 LINE 登入」CTA）
4. 點登入 → 1 秒後固定產生「測試用戶」+ 自動 seed 3 筆歷史報名
5. 點月曆某天 → `/book/flywing/2026-MM-DD` 看時間軸場次列表
6. 點任一場次「報名」→ 完成 form → confirmation
7. 點 header「我的預定」tab → 看到「即將場次」分頁有 1 筆（剛報的）
8. 切到「歷史場次」→ 看到 seed 的 3 筆 demo 完成紀錄

## 已知技術細節
- mock fixed user ID `mock-line-demo-user`（在 `LineLoginModal.tsx` 內常數）
- sessionStorage key：`volleyops-my-bookings-{userId}` / `volleyops-my-bookings-seeded-{userId}`
- 取消規則：開場前 24 小時內不可自行取消（`canCancelBooking()` 判斷，UI 顯示警告訊息）
- 包場入口：規則區「包場價格及流程」末尾 CTA → `/book/rental`
- LoginGate 處理 hydration mismatch：第一次 paint render placeholder 直到 useEffect 跑完

## 接下來建議的下一階段（13.1 / 14）
1. 整理 7 館 `lineCommunityUrl`（用戶會給）
2. 串真實 LINE OAuth（依上方 3 個 hand-off 點）
3. 把後端 `/api/me/bookings` endpoint 補上
4. `BookingShell` 的 `hero` / `backHref` 標 @deprecated 後，做一次清理
