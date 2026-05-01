/**
 * Bundled Icy Veins guide excerpts from scraped JSON (`knowledge/icy-veins/scraped/`).
 * Client-safe: imported by buildContext. Keep payloads bounded.
 */

import rotationFrost64 from '../../knowledge/icy-veins/scraped/mage-frost/rotation-cooldowns-abilities.json'
import rotationUnholy252 from '../../knowledge/icy-veins/scraped/death-knight-unholy/rotation-cooldowns-abilities.json'

export type IcyVeinsCoachingMode = 'compare' | 'solo'

const SPEC_ROTATION: Record<number, typeof rotationFrost64> = {
  64: rotationFrost64,
  252: rotationUnholy252,
}

const SPEC_IDS_WITH_DATA = new Set<number>([64, 252])

const ROTATION_CHAR_BUDGET = 22_000

export function icyVeinsReferenceAvailableForSpec(specId: number | undefined | null): boolean {
  if (specId == null || Number.isNaN(Number(specId))) return false
  return SPEC_IDS_WITH_DATA.has(Number(specId))
}

function formatRotationSnapshot(specId: number): string {
  const doc = SPEC_ROTATION[specId]
  if (!doc) return ''
  const meta = doc.snapshot as {
    icyVeinsArticle?: { headline?: string; dateModified?: string }
  }
  const headline = meta?.icyVeinsArticle?.headline ?? 'Icy Veins guide'
  const updated = meta?.icyVeinsArticle?.dateModified ?? 'unknown'
  let out =
    `Icy Veins **rotation guide** (plain-text excerpts, scraped): ${headline}, updated ${updated}. Source: ${doc.sourceUrl ?? 'icy-veins'}\n\n`

  const panels = doc.imageBlockPanels ?? []
  let used = out.length
  out += '=== Panels (truncated per block) ===\n'
  for (const p of panels) {
    const title = p.tabLabel || p.panelId || '(section)'
    const body = p.bodyPlain || ''
    const chunk = body.slice(0, 4500)
    const block = `\n--- ${title} ---\n${chunk}${body.length > 4500 ? '\n[…truncated…]' : ''}\n`
    if (used + block.length > ROTATION_CHAR_BUDGET) {
      out += '\n[Further panels omitted to stay within prompt budget — see source URL.]\n'
      break
    }
    out += block
    used += block.length
  }
  return out
}

/**
 * Reference text when `icyVeinsGroundedAnalysis` is true (supported specs only).
 */
export function getIcyVeinsReferenceSupplement(
  specId: number | undefined | null,
  grounded: boolean,
  coachingMode: IcyVeinsCoachingMode
): string {
  if (!grounded || specId == null) return ''
  const sid = Number(specId)
  if (!SPEC_IDS_WITH_DATA.has(sid)) return ''

  const header =
    coachingMode === 'solo' ? `=== ICY VEINS — OPT-IN (SOLO) ===\n` : `=== ICY VEINS — OPT-IN COMPARISON ===\n`

  const bodyCompare =
    `Excerpts below are **scraped Icy Veins** rotation text (Midnight-era guides), not live HTML. ` +
    `Use with the combat log, SimulationCraft block (if present), and Wowhead excerpts (if present). ` +
    `Infer each player's hero-talent / build branch from the log before citing a priority list. ` +
    `When guides disagree, explain both and prefer **log evidence**.\n\n`

  const bodySolo =
    `Excerpts below are **scraped Icy Veins** rotation text — optional human-authored priorities alongside other references. ` +
    `Treat as **guide text**, not proof of optimal play for this pull.\n\n`

  const rot = formatRotationSnapshot(sid)
  const footer = `<icy_veins_reference>\n${rot}\n</icy_veins_reference>\n\n`

  return header + (coachingMode === 'solo' ? bodySolo : bodyCompare) + footer
}
