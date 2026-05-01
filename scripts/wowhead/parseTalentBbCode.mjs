/**
 * Parse Wowhead BBCode markup for talent export rows.
 * Looks for [copy="Label"]CODE[/copy] and [url=/talent-calc/blizzard/CODE]
 */

const COPY_RE = /\[copy=(?:"([^"]+)"|([^\]]+))\]([A-Za-z0-9_=+/]+)\[\/copy\]/g
const URL_CALC_RE = /\[url=\/talent-calc\/blizzard\/([A-Za-z0-9_=+/]+)\]/g
const DRAGON_CALC_RE = /\[dragonflight-talent-calc=blizzard\/([A-Za-z0-9_=+/]+)(?:\s[^\]]*)?\]/g

/** Wowhead talent tables: `[h3...][symbol=wow-hero-talent-spellslinger]` then later Frostfire. */
const H3_SPELLSLINGER = /\[h3[^\]]*\]\s*\[symbol=wow-hero-talent-spellslinger\]/i
const H3_FROSTFIRE = /\[h3[^\]]*\]\s*\[symbol=wow-hero-talent-frostfire\]/i

/**
 * @param {string} markup
 * @returns {{ spellslingerStart: number, frostfireStart: number } | null}
 */
function findHeroTalentTableBounds(markup) {
  const sm = markup.match(H3_SPELLSLINGER)
  const fm = markup.match(H3_FROSTFIRE)
  if (!sm || !fm) return null
  return { spellslingerStart: sm.index, frostfireStart: fm.index }
}

/**
 * @param {number} copyIndex
 * @param {{ spellslingerStart: number, frostfireStart: number } | null} bounds
 * @returns {'Spellslinger' | 'Frostfire' | null}
 */
function heroTalentForCopyIndex(copyIndex, bounds) {
  if (!bounds) return null
  if (copyIndex >= bounds.frostfireStart) return 'Frostfire'
  if (copyIndex >= bounds.spellslingerStart) return 'Spellslinger'
  return null
}

/** @typedef {{ label: string | null, importCode: string, source: 'copy', heroTalent?: 'Spellslinger' | 'Frostfire' | null }} CopyRow */
/** @typedef {{ path: string, importCode: string, source: 'url' | 'dragonflight-calc' }} LinkRow */

/**
 * @param {string} markup unescaped BBCode
 * @returns {{ copies: CopyRow[], talentCalcRefs: LinkRow[] }}
 */
export function extractTalentData(markup) {
  /** @type {CopyRow[]} */
  const copies = []
  const bounds = findHeroTalentTableBounds(markup)
  let m
  COPY_RE.lastIndex = 0
  while ((m = COPY_RE.exec(markup)) !== null) {
    const label = (m[1] || m[2] || '').trim() || null
    const importCode = m[3]
    const heroTalent = heroTalentForCopyIndex(m.index, bounds)
    copies.push({
      label,
      importCode,
      source: /** @type {'copy'} */ ('copy'),
      heroTalent,
    })
  }

  /** @type {LinkRow[]} */
  const talentCalcRefs = []
  URL_CALC_RE.lastIndex = 0
  while ((m = URL_CALC_RE.exec(markup)) !== null) {
    talentCalcRefs.push({
      path: `/talent-calc/blizzard/${m[1]}`,
      importCode: m[1],
      source: 'url',
    })
  }
  DRAGON_CALC_RE.lastIndex = 0
  while ((m = DRAGON_CALC_RE.exec(markup)) !== null) {
    talentCalcRefs.push({
      path: `/talent-calc/blizzard/${m[1]}`,
      importCode: m[1],
      source: 'dragonflight-calc',
    })
  }

  return { copies, talentCalcRefs }
}

/**
 * Rough section split on [h2 ...] for preserving rotation structure as plain-text chunks.
 * @param {string} markup
 * @returns {{ heading: string | null, body: string }[]}
 */
export function splitBbCodeSections(markup) {
  const parts = markup.split(/(?=\[h[12]\b)/i)
  /** @type {{ heading: string | null, tocSlug: string | null, body: string }[]} */
  const sections = []
  for (const part of parts) {
    if (!part.trim()) continue
    const toc = part.match(/^\[h[12][^\]]*\btoc="([^"]*)"[^\]]*\]/i)
    const plainTitle = part.match(/^\[h[12][^\]]*\]([\s\S]*?)(?=\n\n|\n\[(?![^\]]*]))/i)
    let heading = toc ? toc[1].trim() : null
    if (!heading && plainTitle) {
      const stripped = plainTitle[1].replace(/\[(\/)?[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim()
      heading = stripped.slice(0, 200) || null
    }
    sections.push({
      heading,
      tocSlug: toc ? toc[1].trim() : null,
      body: part.trim(),
    })
  }
  return sections
}
