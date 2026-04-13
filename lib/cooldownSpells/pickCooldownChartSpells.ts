import { RACIAL_OFFENSIVE_SPELL_IDS } from './racialCooldownIds'
import { MANUAL_COOLDOWN_SPELL_IDS } from './manualCooldownInclusions'

export type SpellRowLike = {
  id: string
  name: string
  ppm1: number
  ppm2: number
  count1: number
  count2: number
  ts1: number[]
  ts2: number[]
}

const EXCLUDED_BUFF_SPELL_IDS = new Set<number>([
  1459,
  27348,
  21562,
  1126,
  21849,
  6673,
  264735,
  264760,
  1044,
])

const EXCLUDED_NAME_PHRASES = [
  'arcane intellect',
  'power word: fortitude',
  'mark of the wild',
  'gift of the wild',
  'battle shout',
  'blessing of might',
  'blessing of kings',
  'blessing of wisdom',
  'blessing of sanctuary',
  'divine spirit',
  'amplify magic',
  'dampen magic',
  'detect magic',
]

const FORCE_INCLUDE_NAME_PHRASES = [
  'bloodlust',
  'heroism',
  'time warp',
  'ancient hysteria',
  'fury of the aspects',
  'primal rage',
  'drums of',
  "haru's resolve",
]

/** Blizzard-reported cooldown at least this long → major CD bar (ms). */
export const MIN_MAJOR_COOLDOWN_MS = 25_000

export function medianCastGap(ts: number[]): number | null {
  const s = [...ts].filter(t => Number.isFinite(t)).sort((a, b) => a - b)
  if (s.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < s.length; i++) {
    const g = s[i] - s[i - 1]
    if (g > 0.05) gaps.push(g)
  }
  if (!gaps.length) return null
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)]
}

function hasPlausibleCooldownSpacing(row: SpellRowLike): boolean {
  const g1 = medianCastGap(row.ts1 || [])
  const g2 = medianCastGap(row.ts2 || [])
  const minGap = 12
  const maxGap = 900
  const ok = (g: number) => g >= minGap && g <= maxGap
  return (g1 != null && ok(g1)) || (g2 != null && ok(g2))
}

export function isForcedMajorCd(row: SpellRowLike): boolean {
  const n = row.name.toLowerCase()
  return FORCE_INCLUDE_NAME_PHRASES.some(p => n.includes(p))
}

export function isLikelyBuffUtility(row: SpellRowLike): boolean {
  if (isForcedMajorCd(row)) return false
  const id = Number(row.id)
  if (Number.isFinite(id) && EXCLUDED_BUFF_SPELL_IDS.has(id)) return true
  const n = row.name.toLowerCase()
  return EXCLUDED_NAME_PHRASES.some(p => n.includes(p))
}

/** When API does not report a cooldown, mirror previous “low frequency + pattern” gate. */
export function heuristicCooldownCandidate(row: SpellRowLike): boolean {
  const ppm = Math.max(row.ppm1, row.ppm2)
  if (ppm <= 0 || ppm >= 3) return false
  const c1 = row.count1 || 0
  const c2 = row.count2 || 0
  if (c1 + c2 === 0) return false
  const maxC = Math.max(c1, c2)
  if (maxC >= 2) return true
  if (hasPlausibleCooldownSpacing(row)) return true
  return false
}

function getCdMs(map: Record<string, number | null | undefined> | null, id: number): number | null | undefined {
  if (!map) return undefined
  const v = map[String(id)]
  return v === undefined ? undefined : v
}

/**
 * Include row if: raid CD phrase, racial list, manual list, Blizzard CD ≥ threshold,
 * or (no/zero API CD) heuristic backup.
 */
export function isCooldownChartRow(
  row: SpellRowLike,
  blizzardCooldownMs: Record<string, number | null | undefined> | null
): boolean {
  if (isLikelyBuffUtility(row)) return false
  const c1 = row.count1 || 0
  const c2 = row.count2 || 0
  if (c1 + c2 === 0) return false

  const id = Number(row.id)
  if (!Number.isFinite(id)) return false

  if (isForcedMajorCd(row)) return true
  if (RACIAL_OFFENSIVE_SPELL_IDS.has(id)) return true
  if (MANUAL_COOLDOWN_SPELL_IDS.has(id)) return true

  const apiMs = getCdMs(blizzardCooldownMs, id)

  if (apiMs != null && apiMs > 0 && apiMs >= MIN_MAJOR_COOLDOWN_MS) return true

  if (apiMs == null || apiMs === 0) {
    const ppm = Math.max(row.ppm1, row.ppm2)
    if (ppm >= 5) return false
    return heuristicCooldownCandidate(row)
  }

  return false
}

export function estimatedCooldownSec(row: SpellRowLike, dur1: number, dur2: number): number {
  const g1 = medianCastGap(row.ts1 || [])
  const g2 = medianCastGap(row.ts2 || [])
  const fromGaps = [g1, g2].filter((x): x is number => x != null && x > 0)
  if (fromGaps.length) return Math.max(...fromGaps)

  const c1 = row.count1 || 0
  const c2 = row.count2 || 0
  const fb1 = c1 > 1 ? dur1 / (c1 - 1) : c1 === 1 ? dur1 : 0
  const fb2 = c2 > 1 ? dur2 / (c2 - 1) : c2 === 1 ? dur2 : 0
  return Math.max(fb1, fb2, 1)
}

/** Sort key: prefer Blizzard CD length, else log spacing estimate. */
export function sortCooldownRows(
  rows: SpellRowLike[],
  blizzardCooldownMs: Record<string, number | null | undefined> | null,
  dur1: number,
  dur2: number
): SpellRowLike[] {
  const apiSec = (id: number) => {
    const ms = blizzardCooldownMs?.[String(id)]
    if (ms != null && ms > 0) return ms / 1000
    return 0
  }

  return [...rows].sort((a, b) => {
    const ida = Number(a.id)
    const idb = Number(b.id)
    const ad = apiSec(ida)
    const bd = apiSec(idb)
    if (bd !== ad) return bd - ad
    return (
      estimatedCooldownSec(b, dur1, dur2) - estimatedCooldownSec(a, dur1, dur2)
    )
  })
}

export function pickCooldownChartSpells(
  spellRows: SpellRowLike[],
  blizzardCooldownMs: Record<string, number | null | undefined> | null,
  dur1: number,
  dur2: number,
  maxSpells = 14
): SpellRowLike[] {
  const picked = spellRows.filter(r => isCooldownChartRow(r, blizzardCooldownMs))
  const sorted = sortCooldownRows(picked, blizzardCooldownMs, dur1, dur2)
  return sorted.slice(0, maxSpells)
}
