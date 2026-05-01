/**
 * Bundled Wowhead guide excerpts from scraped JSON (`knowledge/wowhead/scraped/`).
 * Regenerate snapshots: `npm run scrape-wowhead-frost` (respect Wowhead ToS / rate limits).
 *
 * Client-safe: imported by buildContext (browser bundle). Keep payloads bounded.
 */

import talentFrost64 from '../../knowledge/wowhead/scraped/mage-frost/talent-builds.json'
import rotationFrost64 from '../../knowledge/wowhead/scraped/mage-frost/rotation-cooldowns.json'

export type WowheadCoachingMode = 'compare' | 'solo'

const SPEC_IDS_WITH_DATA = new Set<number>([64])

/** Max characters total for rotation BBCode excerpt (sections + trim). */
const ROTATION_CHAR_BUDGET = 22_000

export function wowheadReferenceAvailableForSpec(specId: number | undefined | null): boolean {
  if (specId == null || Number.isNaN(Number(specId))) return false
  return SPEC_IDS_WITH_DATA.has(Number(specId))
}

function formatTalentSnapshot(): string {
  const t = talentFrost64 as {
    sourceUrl?: string
    talentCopies?: { label: string | null; importCode: string; heroTalent?: string | null }[]
    snapshot?: {
      wowheadDeclaredEdition?: {
        patchLabel?: { label?: string }
        guideLastUpdated?: { displayDate?: string }
      }
      bbcodeSignals?: { seasonBanner?: { phrase?: string } }
    }
  }
  const rows = t.talentCopies ?? []
  const meta = t.snapshot
  const patch = meta?.wowheadDeclaredEdition?.patchLabel?.label ?? 'unknown'
  const updated = meta?.wowheadDeclaredEdition?.guideLastUpdated?.displayDate ?? 'unknown'
  const season = meta?.bbcodeSignals?.seasonBanner?.phrase ?? ''
  const header =
    `Wowhead **talent import table** (scraped): patch label ${patch}, guide updated ${updated}` +
    (season ? `, season tag ${season}` : '') +
    `. Source: ${t.sourceUrl ?? 'wowhead'}\n`
  const lines = rows.map((r) => {
    const hero = r.heroTalent ? `${r.heroTalent} · ` : ''
    const codeShort = r.importCode.length > 48 ? `${r.importCode.slice(0, 48)}…` : r.importCode
    return `- ${hero}${r.label ?? 'build'}: \`${codeShort}\``
  })
  return header + lines.join('\n') + '\n'
}

function formatRotationSnapshot(): string {
  const r = rotationFrost64 as {
    sourceUrl?: string
    sections?: { heading?: string | null; tocSlug?: string | null; body: string }[]
    markupBbCode?: string
    snapshot?: {
      wowheadDeclaredEdition?: {
        patchLabel?: { label?: string }
        guideLastUpdated?: { displayDate?: string }
      }
      bbcodeSignals?: { dbFlavor?: { tag?: string }; seasonBanner?: { phrase?: string } }
    }
  }
  const meta = r.snapshot
  const patch = meta?.wowheadDeclaredEdition?.patchLabel?.label ?? 'unknown'
  const updated = meta?.wowheadDeclaredEdition?.guideLastUpdated?.displayDate ?? 'unknown'
  let out =
    `Wowhead **rotation guide** (BBCode excerpts, scraped): patch label ${patch}, guide updated ${updated}. Source: ${r.sourceUrl ?? 'wowhead'}\n\n`

  const sections = r.sections ?? []
  let used = out.length
  out += '=== Sections (truncated per block) ===\n'
  for (const sec of sections) {
    const title = sec.tocSlug || sec.heading || '(intro)'
    const chunk = sec.body.slice(0, 4500)
    const block = `\n--- ${title} ---\n${chunk}${sec.body.length > 4500 ? '\n[…truncated…]' : ''}\n`
    if (used + block.length > ROTATION_CHAR_BUDGET) {
      out += '\n[Further sections omitted to stay within prompt budget — see source URL.]\n'
      break
    }
    out += block
    used += block.length
  }
  return out
}

/**
 * Reference text for prompts when `wowheadGroundedAnalysis` is true (opt-in).
 * Only specs present in scraped JSON are supported (Frost Mage / 64 initially).
 */
export function getWowheadReferenceSupplement(
  specId: number | undefined | null,
  grounded: boolean,
  playerName: string | undefined,
  coachingMode: WowheadCoachingMode
): string {
  if (!grounded || specId !== 64) return ''
  const who = playerName?.trim() || 'the player'

  const header =
    coachingMode === 'solo'
      ? `=== WOWHEAD — OPT-IN (SOLO) ===\n`
      : `=== WOWHEAD — OPT-IN COMPARISON ===\n`

  const bodyCompare =
    `Excerpts below are **scraped Wowhead BBCode** for Frost Mage (Midnight-era guides), not live HTML. ` +
    `Use them together with the combat log and SimulationCraft block (if present). ` +
    `Wowhead uses hero-talent-specific priorities (Spellslinger vs Frostfire); infer which branch matches ${who}'s talents from the log before citing a priority list.\n` +
    `When Wowhead and SimC disagree, explain both and prefer **log evidence**.\n\n`

  const bodySolo =
    `Excerpts below are **scraped Wowhead BBCode** for Frost Mage — optional human-authored priorities alongside SimC. ` +
    `Treat them as **guide text**, not proof of optimal play for this pull.\n\n`

  const talentBlock = formatTalentSnapshot()
  const rotBlock = formatRotationSnapshot()

  const footer =
    `<wowhead_reference>\n${talentBlock}\n${rotBlock}\n</wowhead_reference>\n\n`

  return header + (coachingMode === 'solo' ? bodySolo : bodyCompare) + footer
}
