// ============================================================
// data/skill.ts — 程度（E~S*）計算工具（client + server 共用，純型別）
// ------------------------------------------------------------
// 四項自評（攻擊/防守/舉球/攔網）→ 平均 → 顯示為準確值（A）或區間（C~B）。
// 九級當 0~8 分：E D C B B+ A A+ S S*。
// ============================================================

import type { SkillLevel } from '@/types'

export const SKILL_LEVELS: SkillLevel[] = ['E', 'D', 'C', 'B', 'B+', 'A', 'A+', 'S', 'S*']

export function skillToIndex(s: SkillLevel): number {
  const i = SKILL_LEVELS.indexOf(s)
  return i < 0 ? 0 : i
}
export function indexToSkill(i: number): SkillLevel {
  const clamped = Math.max(0, Math.min(SKILL_LEVELS.length - 1, Math.round(i)))
  return SKILL_LEVELS[clamped]
}

export type FourSkills = {
  attack: SkillLevel | null
  defense: SkillLevel | null
  setting: SkillLevel | null
  block: SkillLevel | null
}

/** 有填的項目（忽略 null） */
function presentIndices(a: FourSkills): number[] {
  return [a.attack, a.defense, a.setting, a.block]
    .filter((x): x is SkillLevel => !!x)
    .map(skillToIndex)
}

/** 四項平均分數（0~8）；四項皆無回 null */
export function averageSkillIndex(a: FourSkills): number | null {
  const v = presentIndices(a)
  if (!v.length) return null
  return v.reduce((s, x) => s + x, 0) / v.length
}

/** 四項平均 → 四捨五入到最近一級（供單一值欄位 / 顏色 / 篩選用） */
export function averageSkillLevel(a: FourSkills): SkillLevel | null {
  const avg = averageSkillIndex(a)
  return avg == null ? null : indexToSkill(avg)
}

/**
 * 顯示標籤：平均落在整級 → 準確值（例 'A'）；
 * 落在兩級之間 → 區間（例 'C~B'）；四項皆無 → null。
 */
export function skillRangeLabel(a: FourSkills): string | null {
  const avg = averageSkillIndex(a)
  if (avg == null) return null
  const lo = Math.floor(avg)
  const hi = Math.ceil(avg)
  return lo === hi ? SKILL_LEVELS[lo] : `${SKILL_LEVELS[lo]}~${SKILL_LEVELS[hi]}`
}
