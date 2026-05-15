// ============================================================
// components/booking/rules-content.tsx — 規則區六章文字模組
// ============================================================
// 階段 13 新增。
//
// 重要：館主決定 7 個館共用「飛翼」這套規則文字。文字內容直接照舊飛翼系統
// 的截圖文案。若未來各館需要個別客製，可改成 record-by-slug 結構。
//
// 設計：純文字模組（每章一個 React node），由 RulesSection 渲染。
// 文字內容不含 LINE 連結（連結由 RulesSection 從 venueInfo 注入）。
// ============================================================

import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'
import type { PublicVenueInfo } from '@/data/api'

// ─────────────────────────────────────────────────────────────
// 字級樣式 (共用)
// ─────────────────────────────────────────────────────────────
const styles = {
  para: {
    margin: '0 0 12px',
    fontSize: 13.5,
    lineHeight: 1.85,
    color: BOOKING_COLORS.textSecondary,
  } as React.CSSProperties,
  paraStrong: {
    margin: '0 0 12px',
    fontSize: 13.5,
    lineHeight: 1.85,
    color: BOOKING_COLORS.textPrimary,
    fontWeight: 600,
  } as React.CSSProperties,
  sectionHeader: {
    margin: '14px 0 8px',
    fontSize: 14,
    fontWeight: 700,
    color: BOOKING_COLORS.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,
  redDot: {
    color: BOOKING_COLORS.warn,
    fontSize: 12,
    marginRight: 2,
  } as React.CSSProperties,
  diamond: {
    color: BOOKING_COLORS.pinkVivid,
    fontSize: 11,
    marginRight: 4,
  } as React.CSSProperties,
  triangle: {
    color: '#e3a23c',
    fontSize: 11,
    marginRight: 4,
  } as React.CSSProperties,
  link: {
    color: BOOKING_COLORS.lineGreen,
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  } as React.CSSProperties,
  pinkBox: {
    background: BOOKING_COLORS.pinkSoft,
    border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
    borderRadius: BOOKING_RADIUS.md,
    padding: '12px 14px',
    margin: '10px 0',
    fontSize: 12.5,
    lineHeight: 1.85,
    color: BOOKING_COLORS.textPrimary,
  } as React.CSSProperties,
  noticeBox: {
    background: '#fffbef',
    border: '1px solid #f4e1a3',
    borderRadius: BOOKING_RADIUS.md,
    padding: '14px 16px',
    margin: '12px 0',
  } as React.CSSProperties,
  dateLabel: {
    textAlign: 'center' as const,
    fontSize: 12,
    color: BOOKING_COLORS.textMuted,
    marginBottom: 4,
    letterSpacing: 1,
  } as React.CSSProperties,
  noticeTitle: {
    textAlign: 'center' as const,
    fontSize: 18,
    fontWeight: 700,
    color: BOOKING_COLORS.textPrimary,
    margin: '4px 0 12px',
    fontFamily: BOOKING_FONTS.display,
  } as React.CSSProperties,
}

// ─────────────────────────────────────────────────────────────
// 1. 球場相關守則
// ─────────────────────────────────────────────────────────────
export function CourtRules() {
  return (
    <>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        場館外請勿吸菸，戶外吸菸區設於門口右側，請主動使用菸灰缸並妥善處理菸蒂。
      </p>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        入場後貴重物品請自行妥善保管，館方不負物品保管責任。
      </p>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        休息區域內可飲食（分隔網後），請勿將飲料、食物等放置於門口鞋櫃或椅子上避免打翻。球場區域則禁止飲食。
      </p>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        請勿對館內帆布區域（鐵皮）進行扣球熱身，避免影響到鄰居，請務必配合!!
      </p>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        非工作人員請勿進入櫃台，若需購買冰箱飲料、零食或商品請找工作人員。
      </p>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        如人為損壞公物，需賠償部分之金額（金額依照公物購入價格 30%~50%），請愛惜球場公物，共同維護環境～
      </p>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 2. 報名須知（含 LINE 連結注入）
// ─────────────────────────────────────────────────────────────
export function RegistrationNotice({ venueInfo }: { venueInfo: PublicVenueInfo }) {
  return (
    <>
      <p style={styles.para}>
        <span style={styles.redDot}>⛔</span>
        各場次均可直接透過報名網站報名，未滿 12 人之臨打團視為流團，將不再另行通知。
      </p>

      <p style={{ ...styles.para, marginBottom: 6 }}>
        <span style={styles.diamond}>◆</span>
        <strong style={{ color: BOOKING_COLORS.textPrimary }}>報名前請加入：</strong>
      </p>

      <ul style={{ margin: '0 0 12px', paddingLeft: 22, fontSize: 13, lineHeight: 1.9, color: BOOKING_COLORS.textSecondary }}>
        <li>
          🟢 LINE 官方帳號 →{' '}
          <a href={venueInfo.lineOfficialUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
            {venueInfo.lineOfficialUrl}
          </a>
        </li>
        {venueInfo.lineCommunityUrl ? (
          <li style={{ marginTop: 4 }}>
            🟢 LINE 社群 →{' '}
            <a href={venueInfo.lineCommunityUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {venueInfo.lineCommunityUrl}
            </a>
          </li>
        ) : null}
      </ul>

      {venueInfo.lineCommunityUrl ? (
        <p style={{ ...styles.para, fontSize: 12.5, color: BOOKING_COLORS.textMuted }}>
          （LINE 社群內包含場次是否成團、各場次缺額、失物招領與場次更改通知……等資訊）
        </p>
      ) : null}

      <div style={styles.noticeBox}>
        <p style={{ ...styles.para, margin: 0 }}>
          <span style={styles.triangle}>▲</span>
          <strong style={{ color: BOOKING_COLORS.textPrimary }}>重要前情提示：</strong>
          加入 LINE@ 官方帳號 再報名，才會收到『場次報名、候補補上通知』喔！
        </p>
      </div>

      <p style={styles.paraStrong}>進入『場次預定』頁籤</p>
      <p style={styles.para}>➔ 點選上方日曆按鈕，並選擇想打球的日期</p>
      <p style={styles.para}>
        <span style={styles.diamond}>◆</span>
        報名請務必使用『本名』與『正確存在的電話號碼』填寫資料，以利場館作業，謝謝各位～
      </p>

      <p style={styles.para}>
        報名完成後，可在『我的預定』頁籤查詢到已報名場次。
      </p>

      <div style={{ ...styles.noticeBox, background: '#fff5f5', borderColor: '#f4cccc' }}>
        <p style={{ ...styles.para, margin: 0, color: BOOKING_COLORS.textPrimary }}>
          ⚠️ 本場館系統預設場次開始 24H 前不能取消報名，如臨時有事無法到場，請務必私訊官方帳號，並自行至社群尋找替補，無故未到者將列為黑名單。待繳齊未到場次之金額，方得以解除黑名單！
        </p>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. 取消報名以及候補補位機制
// ─────────────────────────────────────────────────────────────
export function CancelPolicy() {
  return (
    <>
      <div style={styles.dateLabel}>2025 / 10 / 25</div>
      <div style={styles.noticeTitle}>報名系統取消報名更新公告</div>

      <p style={{ ...styles.para, textAlign: 'center' }}>
        報名系統原為前一天場次可自行取消，
        <br />
        但部分球友在最後一刻才取消隔天的場次
        <br />
        半夜才取消隔天一早 9:00 的場次，其實找人來說實屬不易 :(
        <br />
        更新後報名可自行取消之時限調整為
      </p>

      <p style={{
        textAlign: 'center', color: BOOKING_COLORS.warn, fontWeight: 700,
        fontSize: 14, margin: '8px 0 16px',
      }}>
        該場次的 24 小時前可自行取消
      </p>

      <p style={{ ...styles.para, textAlign: 'center', fontSize: 12.5, color: BOOKING_COLORS.textMuted }}>
        範例：週六早上 09:00 的場，最後取消時間是週五早上 08:59
      </p>

      <div style={styles.pinkBox}>
        <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
          若於 24 小時內 如因身體不適、受傷等等無法出席：
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12 }}>
          出示本人的就醫證明並提早通知官方帳號，館方將協助尋找候補！
        </p>
        <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
          若於 24 小時內個人理由無法出席場次：
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12 }}>請自行至社群尋找替補</p>
        <p style={{ margin: '0 0 4px', fontWeight: 700 }}>無故未出席報名場次：</p>
        <p style={{ margin: 0, fontSize: 12 }}>
          將列為黑名單，待補齊該場次費用方可解除黑名單
        </p>
      </div>

      <p style={{ ...styles.para, textAlign: 'center', fontSize: 11.5, color: BOOKING_COLORS.textMuted, marginTop: 8 }}>
        * 以上更新如有任何問題或建議，請私訊官方帳號 *
      </p>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 4. 包場價格及流程
// ─────────────────────────────────────────────────────────────
export function RentalInfo({ venueSlug }: { venueSlug: string }) {
  return (
    <>
      <p style={styles.paraStrong}>
        <span style={styles.redDot}>⛔</span>
        包場預約須知
      </p>

      <p style={styles.para}>
        ■ 未開團（報名人數未達 12 人）之臨打場次
        <br />
        ➔ 若包場主揪完成包場手續，將發送簡訊通知該場次已報名臨打之球友。
      </p>
      <p style={styles.para}>
        ■ 已開團（報名人數已達 12 人）之臨打場次
        <br />
        ➔ 不開放包場，保障已報名臨打球友的權益。
      </p>

      <p style={styles.paraStrong}>
        <span style={styles.triangle}>▲</span>
        冷門時段（週一到週五 0900-1900）
      </p>
      <p style={styles.para}>➔ 場地費 $1,000 元/hr</p>

      <p style={styles.paraStrong}>
        <span style={styles.triangle}>▲</span>
        熱門時段（週一到週五晚上 1900-2200 & 假日 0900-2200）
      </p>
      <p style={styles.para}>➔ 場地費 $1,600 元/hr</p>

      <p style={styles.paraStrong}>
        <span style={styles.triangle}>▲</span>
        冷氣費一律現場收費 270 元/hr
      </p>

      <p style={{ ...styles.paraStrong, marginTop: 18 }}>✅ 包場流程</p>
      <ol style={{ margin: '0 0 12px', paddingLeft: 22, fontSize: 13, lineHeight: 1.9, color: BOOKING_COLORS.textSecondary }}>
        <li>聯絡官方帳號 → 提供您想包場的網別、日期及時段</li>
        <li>確認日期後填寫租借契約書 → 回傳契約並完成匯款</li>
      </ol>

      <p style={styles.para}>
        <span style={styles.triangle}>⚠️</span>
        回傳契約及匯款完成才算完成包場手續喔！
      </p>
      <p style={styles.para}>
        <span style={styles.triangle}>⚠️</span>
        如簽訂契約後，24 小時內未匯款會再次提醒，若無收到回覆及訂金，會將包場時段優先讓給其他球友。
      </p>

      <p style={{ ...styles.paraStrong, textAlign: 'center', marginTop: 14 }}>
        <span style={{ color: BOOKING_COLORS.warn }}>◆</span> 本場得保留以上規範之修改權力{' '}
        <span style={{ color: BOOKING_COLORS.warn }}>◆</span>
      </p>

      {/* CTA：連到既有的 /book/rental */}
      <a
        href={`/book/rental`}
        style={{
          display: 'block',
          marginTop: 14,
          padding: '12px',
          textAlign: 'center',
          background: BOOKING_COLORS.pinkSoft,
          color: BOOKING_COLORS.pinkVividDeep,
          border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
          borderRadius: BOOKING_RADIUS.md,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 13.5,
        }}
      >
        前往包場詢問頁 →
      </a>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 5. 公務損壞之賠償
// ─────────────────────────────────────────────────────────────
export function DamageCompensation() {
  return (
    <>
      <p style={styles.para}>打球是種享受 😎</p>
      <p style={styles.para}>但為了維護大家可以享受球場的權益</p>
      <p style={styles.para}>所以愛惜球場公物和維護環境整潔也很重要‼️</p>
      <p style={styles.para}>在球館打球期間注意自身安全以外，</p>
      <p style={styles.para}>也請大家愛惜球館公物，為了避免造成不必要的損壞</p>

      <p style={{ ...styles.para, marginTop: 12 }}>
        如果不小心造成球館公物損壞，請主動通知工作人員並配合處理，賠償人為損壞的部分金額保障其他球友的權益。
      </p>

      <p style={{ ...styles.para, marginTop: 12 }}>感謝大家理解與合作，共同維護一個舒適的運動環境！</p>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 6. 車輛停放規定（含停車示意圖 SVG）
// ─────────────────────────────────────────────────────────────
export function ParkingRules() {
  return (
    <>
      <p style={styles.paraStrong}>汽 / 機車：</p>
      <p style={styles.para}>
        可臨停在其他倉庫廠房前（黃色標示可停車區域），請記得留下聯絡電話！
      </p>
      <p style={styles.para}>
        <span style={styles.triangle}>⚠️</span>
        隔壁廠房鐵捲門處 & 兩側轉角處禁止停放汽車，會影響到鄰居唷～～
      </p>

      {/* SVG 停車示意圖 — 純 inline，無外部資源 */}
      <div style={{
        marginTop: 14,
        padding: 12,
        background: '#fafafa',
        borderRadius: BOOKING_RADIUS.md,
        border: `1px solid ${BOOKING_COLORS.borderLight}`,
      }}>
        <div style={{
          fontSize: 11, color: BOOKING_COLORS.textMuted, marginBottom: 8,
          textAlign: 'center', letterSpacing: 1,
        }}>
          停車示意圖
        </div>
        <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
          {/* 道路底 */}
          <rect x="0" y="0" width="320" height="200" fill="transparent" />
          {/* 上排：可停車區域（垂直長條，最右側） */}
          <rect x="270" y="20" width="38" height="70" fill="#fff7c2" stroke="#d4b94a" strokeWidth="1" />
          <text x="289" y="40" fontSize="9" fill="#7a5b2f" textAnchor="middle" writingMode="tb">可停</text>
          <text x="289" y="64" fontSize="9" fill="#7a5b2f" textAnchor="middle" writingMode="tb">區域</text>
          {/* 禁停 (右側轉角上方) */}
          <rect x="270" y="92" width="38" height="22" fill="#ffd9d9" stroke="#d46c6c" strokeWidth="1" />
          <text x="289" y="107" fontSize="9" fill="#a83838" textAnchor="middle" fontWeight="700">禁停</text>
          {/* 飛翼館（中間） */}
          <rect x="160" y="115" width="62" height="20" fill="#3d3d3d" />
          <text x="191" y="129" fontSize="10" fill="#fde7c6" textAnchor="middle" fontWeight="700">飛翼</text>
          {/* 可停車區域 (中間長條) */}
          <rect x="92" y="138" width="135" height="22" fill="#fff7c2" stroke="#d4b94a" strokeWidth="1" />
          <text x="160" y="153" fontSize="10" fill="#7a5b2f" textAnchor="middle" fontWeight="700">可停車區域</text>
          {/* 左禁停 */}
          <rect x="50" y="138" width="38" height="22" fill="#ffd9d9" stroke="#d46c6c" strokeWidth="1" />
          <text x="69" y="153" fontSize="9" fill="#a83838" textAnchor="middle" fontWeight="700">禁停</text>
          {/* 右禁停 */}
          <rect x="231" y="138" width="36" height="22" fill="#ffd9d9" stroke="#d46c6c" strokeWidth="1" />
          <text x="249" y="153" fontSize="9" fill="#a83838" textAnchor="middle" fontWeight="700">禁停</text>
          {/* 最左可停 */}
          <rect x="8" y="138" width="38" height="22" fill="#fff7c2" stroke="#d4b94a" strokeWidth="1" />
          <text x="27" y="150" fontSize="7" fill="#7a5b2f" textAnchor="middle">可停車區域</text>
          {/* 圍籬 (左) */}
          <g stroke="#8b6c3f" strokeWidth="1.5" fill="none">
            <line x1="20" y1="110" x2="20" y2="138" />
            <line x1="32" y1="110" x2="32" y2="138" />
            <line x1="14" y1="120" x2="40" y2="120" />
            <line x1="14" y1="130" x2="40" y2="130" />
          </g>
          {/* 道路指引箭頭 (下方) */}
          <g fill="#3d2a30" stroke="none">
            <polygon points="65,178 80,178 80,174 90,182 80,190 80,186 65,186" opacity="0.7" />
            <polygon points="105,178 120,178 120,174 130,182 120,190 120,186 105,186" opacity="0.7" />
            <polygon points="145,178 160,178 160,174 170,182 160,190 160,186 145,186" opacity="0.7" />
            <polygon points="185,178 200,178 200,174 210,182 200,190 200,186 185,186" opacity="0.7" />
          </g>
          {/* 右側上方道路箭頭 */}
          <g fill="#3d2a30" stroke="none" opacity="0.7">
            <polygon points="240,90 244,90 244,76 240,76 247,66 254,76 250,76 250,90" />
            <polygon points="240,124 244,124 244,110 240,110 247,100 254,110 250,110 250,124" />
          </g>
        </svg>

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', fontSize: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: BOOKING_COLORS.textSecondary }}>
            <span style={{ display: 'inline-block', width: 12, height: 10, background: '#fff7c2', border: '1px solid #d4b94a' }} />
            可停車區域
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: BOOKING_COLORS.textSecondary }}>
            <span style={{ display: 'inline-block', width: 12, height: 10, background: '#ffd9d9', border: '1px solid #d46c6c' }} />
            禁停區域
          </span>
        </div>
      </div>
    </>
  )
}
