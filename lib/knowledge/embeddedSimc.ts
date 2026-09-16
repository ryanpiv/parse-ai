/**
 * SimC APL prompt supplement. The APL text and per-spec registry live in the
 * generated ./embeddedSimcData (npm run embed-simc after refreshing any
 * knowledge/simc/*.midnight.simc mirror).
 *
 * Upstream: https://github.com/simulationcraft/simc/tree/midnight/ActionPriorityLists/default
 * License: SimulationCraft is GPL-3.0 (see upstream COPYING).
 */
import { APL_BY_SPEC_ID, SIMC_BUNDLE_BY_SPEC_ID } from './embeddedSimcData'

export type { SimcBundleMeta } from './embeddedSimcData'
export { SIMC_BUNDLE_BY_SPEC_ID } from './embeddedSimcData'

export function simcAplAvailableForSpec(specId: number | undefined | null): boolean {
  if (specId == null || Number.isNaN(Number(specId))) return false
  return Object.prototype.hasOwnProperty.call(SIMC_BUNDLE_BY_SPEC_ID, Number(specId))
}

export type SimcCoachingMode = 'compare' | 'solo'

/**
 * SimC APL text for prompts. When `grounded` is false, omit entirely (default analyze flow
 * stays log- and partner-first; no SimC block).
 */
export function getSimcAplSupplement(
  specId: number | undefined | null,
  grounded: boolean,
  playerName?: string,
  coachingMode: SimcCoachingMode = 'compare'
): string {
  if (!grounded || specId == null || Number.isNaN(Number(specId))) return ''
  const id = Number(specId)
  const meta = SIMC_BUNDLE_BY_SPEC_ID[id]
  const apl = APL_BY_SPEC_ID[id]
  if (!meta || !apl) return ''

  const b = meta.branch
  const specLabel = meta.displayName
  const who = playerName?.trim() || 'the player seeking improvement'

  const header =
    coachingMode === 'solo'
      ? `=== SIMULATIONCRAFT — OPT-IN (SOLO COACHING) ===\n`
      : `=== SIMULATIONCRAFT — OPT-IN COMPARISON MODE ===\n`

  const bodyCompare =
    `The player **turned on** comparison against SimulationCraft's default ${specLabel} APL (branch \`${b}\`). ` +
    `Use the APL below as a **primary** reference together with the combat log to find where ${who}'s casts, timing, or conditions ` +
    `diverge from what this default sim priority would suggest for similar talents and target counts.\n` +
    `Name clear divergences when the log supports them (e.g. "vs default SimC priority: …"). ` +
    `Still cite spell IDs and timestamps from the data. If SimC conditions clearly do not apply (movement, fight length, talents differ), say so.\n`

  const bodySolo =
    `The player **turned on** SimulationCraft's default ${specLabel} APL (branch \`${b}\`) as an **optional heuristic**, not a Patchwerk verdict on this pull.\n\n` +
    `How to use it like an expert:\n` +
    `- **One log ≠ sim distribution.** Sims average many idealized pulls; this encounter is one RNG and mechanics sample — do not treat every APL difference as proof of a mistake.\n` +
    `- **Assumptions differ.** Default APLs simplify reality (target counts, movement, fight length, averaged procs). Boss scripts, adds, Bloodlust timing, or wipes can invalidate **literal** APL ordering without bad play.\n` +
    `- **Hypothesis then verify.** Use the APL to guess what might be efficient under *similar* conditions; then **confirm or reject** with buffs, timestamps, spacing/crit data, and encounter timing in this prompt. If sim conditions clearly do not apply, say so plainly rather than implying fault.\n` +
    `- **Opener / precombat** lines are **sim conventions** (scripted CDs, precombat actions). Many bosses need a different opener — judge the first ~20s against **this pull's** constraints, not a generic sim pull.\n\n` +
    `Still cite spell IDs and timestamps from the log for every concrete claim about ${who}.\n`

  const footer =
    `Upstream: ${meta.upstreamUrl}\n` +
    `Spell names in the APL use SimC identifiers (e.g. frostbolt vs in-game capitalization).\n\n` +
    '<simc_apl>\n' +
    apl +
    '\n</simc_apl>\n\n'

  return header + (coachingMode === 'solo' ? bodySolo : bodyCompare) + footer
}
