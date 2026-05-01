/**
 * Pull edition metadata from raw Wowhead guide HTML (not from BBCode).
 * Sources are cited in return objects so downstream JSON can explain claims.
 */

/** CloudFront / WAF block — no article body. */
export function isBlockedOrErrorHtml(html) {
  return (
    /403\s+ERROR/i.test(html) ||
    /Request blocked/i.test(html) ||
    /ERROR: The request could not be satisfied/i.test(html)
  )
}

/**
 * Sidebar subtitle next to "Guide Contents", e.g. "Patch 12.0.5".
 * Example source (saved page): `<div class="interior-sidebar-header-text-subtitle">\n Patch 12.0.5`
 */
export function extractSidebarPatchLabel(html) {
  const m = html.match(
    /interior-sidebar-header-text-subtitle[^>]*>\s*Patch\s+([\d.]+)\s*</i
  )
  if (!m) return null
  return {
    label: `Patch ${m[1]}`,
    patchSemverLike: m[1],
    sourcedFrom:
      'Wowhead HTML: `.interior-sidebar-header-text-subtitle` contains the literal text "Patch X.Y.Z"',
  }
}

/**
 * Guide header byline "Updated: YYYY/MM/DD".
 * Example: `<span class="guide-content-byline-changed"> ... <span class="date-tip" ...>2026/04/20</span>`
 */
export function extractGuideHeaderUpdatedDate(html) {
  const m = html.match(/guide-content-byline-changed[\s\S]{0,800}?class="date-tip"[^>]*>\s*([\d/]+)\s*</i)
  if (!m) return null
  return {
    displayDate: m[1].trim(),
    sourcedFrom:
      'Wowhead HTML: `.guide-content-byline-changed` / `.date-tip` shows the guide revision date',
  }
}

/**
 * Numeric guide id appears in scripts (e.g. ContactTool guide: 3040, WH.Favorites.pageInit(..., 3040)).
 */
export function extractGuideNumericId(html) {
  const m = html.match(/\bguide["']?\s*[:=]\s*(\d{3,6})\b/)
  if (m) return { guideId: Number(m[1]), sourcedFrom: 'Wowhead HTML: script/init references `guide: <id>`' }
  const m2 = html.match(/WH\.Favorites\.pageInit\([^,]+,[^,]+,\s*(\d+)\s*\)/)
  if (m2) return { guideId: Number(m2[1]), sourcedFrom: 'Wowhead HTML: `WH.Favorites.pageInit(..., guideId)`' }
  return null
}

/**
 * First-line Wowhead flavor tag, e.g. `[db=live]` at start of rotation articles.
 */
export function extractBbCodeDbFlavor(markup) {
  const m = markup.match(/^\[db=([^\]]+)\]/)
  if (!m) return null
  return {
    tag: `db=${m[1]}`,
    sourcedFrom: 'Leading tokens of extracted guide-body BBCode (`WH.markup.printHtml` first argument)',
  }
}

/**
 * Common explicit season tag in guide intros, e.g. `[b]Midnight Season 1[/b]`.
 */
export function extractBbCodeSeasonBanner(markup) {
  const m = markup.match(/\[b\](Midnight Season \d+)\[\/b\]/i)
  if (!m) return null
  return {
    phrase: m[1],
    sourcedFrom:
      'Wowhead BBCode: bracket emphasis block `Midnight Season N` in guide-body article text',
  }
}
