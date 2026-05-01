/**
 * Bundled Wowhead guide excerpts from scraped JSON (`knowledge/wowhead/scraped/`).
 * Client-safe: imported by buildContext. Keep payloads bounded.
 */

import talentFrost64 from '../../knowledge/wowhead/scraped/mage-frost/talent-builds.json'
import rotationFrost64 from '../../knowledge/wowhead/scraped/mage-frost/rotation-cooldowns.json'
import talentUnholy252 from '../../knowledge/wowhead/scraped/death-knight-unholy/talent-builds.json'
import rotationUnholy252 from '../../knowledge/wowhead/scraped/death-knight-unholy/rotation-cooldowns.json'

export type WowheadCoachingMode = 'compare' | 'solo'

const ROTATION_CHAR_BUDGET = 22_000

const SPEC_IDS_WITH_DATA = new Set<number>([64, 252])

export function wowheadReferenceAvailableForSpec(specId: number | undefined | null): boolean {
  if (specId == null || Number.isNaN(Number(specId))) return false
  return SPEC_IDS_WITH_DATA.has(Number(specId))
}

function talentDoc(specId: number) {
  if (specId === 64) return talentFrost64
  if (specId === 252) return talentUnholy252
  return null
}

function rotationDoc(specId: number) {
  if (specId === 64) return rotationFrost64
  if (specId === 252) return rotationUnholy252
  return null
}

function formatTalentSnapshot(specId: number): string {
  const t = talentDoc(specId) as {
    sourceUrl?: string
    talentCopies?: { label: string | null; importCode: string; heroTalent?: string | null }[]
    snapshot?: {
      wowheadDeclaredEdition?: { patchLabel?: { label?: string }; guideLastUpdated?: { displayDate?: string } }
      bbcodeSignals?: { seasonBanner?: { phrase?: string } }
    } | null
    blizzardTalentExports?: { samples?: unknown[] }
  } | null
  if (!t) return ''

  const rows = t.talentCopies ?? []
  const meta = t.snapshot
  const patch = meta?.wowheadDeclaredEdition?.patchLabel?.label ?? 'unknown'
  const updated = meta?.wowheadDeclaredEdition?.guideLastUpdated?.displayDate ?? 'unknown'
  const season = meta?.bbcodeSignals?.seasonBanner?.phrase ?? ''
  const header =
    `Wowhead **talent import table** (scraped): patch label ${patch}, guide updated ${updated}` +
    (season ? `, season tag ${season}` : '') +
    `. Source: ${t.sourceUrl ?? 'wowhead'}\n`

  if (rows.length > 0) {
    const lines = rows.map((r) => {
      const hero = r.heroTalent ? `${r.heroTalent} · ` : ''
      const codeShort = r.importCode.length > 48 ? `${r.importCode.slice(0, 48)}…` : r.importCode
      return `- ${hero}${r.label ?? 'build'}: \`${codeShort}\``
    })
    return header + lines.join('\n') + '\n'
  }

  const samples = (t.blizzardTalentExports?.samples as { heroTalent?: string; copy?: string }[] | undefined) ?? []
  if (samples.length > 0) {
    const lines = samples.slice(0, 12).map((s) => {
      const hero = s.heroTalent ? `${s.heroTalent} · ` : ''
      const c = s.copy ?? ''
      const codeShort = c.length > 48 ? `${c.slice(0, 48)}…` : c
      return `- ${hero}\`${codeShort}\``
    })
    return header + lines.join('\n') + '\n'
  }

  return header + '(no talent import rows in scrape)\n'
}

function formatRotationSnapshot(specId: number): string {
  const r = rotationDoc(specId) as {
    sourceUrl?: string
    sections?: { heading?: string | null; tocSlug?: string | null; body: string }[]
    snapshot?: {
      wowheadDeclaredEdition?: { patchLabel?: { label?: string }; guideLastUpdated?: { displayDate?: string } }
      bbcodeSignals?: { dbFlavor?: { tag?: string }; seasonBanner?: { phrase?: string } }
    }
  } | null
  if (!r) return ''

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
    const chunk = (sec.body ?? '').slice(0, 4500)
    const body = sec.body ?? ''
    const block = `\n--- ${title} ---\n${chunk}${body.length > 4500 ? '\n[…truncated…]' : ''}\n`
    if (used + block.length > ROTATION_CHAR_BUDGET) {
      out += '\n[Further sections omitted to stay within prompt budget — see source URL.]\n'
      break
    }
    out += block
    used += block.length
  }
  return out
}

function bodyCompareForSpec(specId: number): string {
  if (specId === 64) {
    return (
      `Excerpts below are **scraped Wowhead BBCode** for Frost Mage (Midnight-era guides), not live HTML. ` +
      `Use them together with the combat log and SimulationCraft block (if present). ` +
      `Wowhead uses hero-talent-specific priorities (Spellslinger vs Frostfire); infer which branch matches **each** player's talents from the log before citing a priority list.\n` +
      `When Wowhead and SimC disagree, explain both and prefer **log evidence**.\n\n`
    )
  }
  if (specId === 252) {
    return (
      `Excerpts below are **scraped Wowhead BBCode** for Unholy Death Knight (Midnight-era guides), not live HTML. ` +
      `Use them with the combat log and SimulationCraft block (if present). ` +
      `Infer each player's hero-talent branch from the log before citing priority lists.\n` +
      `When guides and SimC disagree, explain both and prefer **log evidence**.\n\n`
    )
  }
  return ''
}

function bodySoloForSpec(specId: number): string {
  if (specId === 64) {
    return (
      `Excerpts below are **scraped Wowhead BBCode** for Frost Mage — optional human-authored priorities alongside SimC. ` +
      `Treat them as **guide text**, not proof of optimal play for this pull.\n\n`
    )
  }
  if (specId === 252) {
    return (
      `Excerpts below are **scraped Wowhead BBCode** for Unholy DK — optional priorities alongside SimC. ` +
      `Treat as **guide text**, not proof of optimal play for this pull.\n\n`
    )
  }
  return ''
}

/**
 * Reference text when `wowheadGroundedAnalysis` is true (bundled specs only).
 */
export function getWowheadReferenceSupplement(
  specId: number | undefined | null,
  grounded: boolean,
  _playerName: string | undefined,
  coachingMode: WowheadCoachingMode
): string {
  if (!grounded || specId == null || !SPEC_IDS_WITH_DATA.has(Number(specId))) return ''

  const sid = Number(specId)
  const header =
    coachingMode === 'solo' ? `=== WOWHEAD — OPT-IN (SOLO) ===\n` : `=== WOWHEAD — OPT-IN COMPARISON ===\n`

  const bodyCompare = bodyCompareForSpec(sid)
  const bodySolo = bodySoloForSpec(sid)
  const talentBlock = formatTalentSnapshot(sid)
  const rotBlock = formatRotationSnapshot(sid)

  const footer = `<wowhead_reference>\n${talentBlock}\n${rotBlock}\n</wowhead_reference>\n\n`

  return header + (coachingMode === 'solo' ? bodySolo : bodyCompare) + footer
}
