/**
 * Parse stable signals from Icy Veins WoW guide HTML (server-rendered article body,
 * Midnight talent embed args, JSON-LD, breadcrumb TOC).
 */

/**
 * @param {string} html
 * @returns {string}
 */
export function stripScriptAndStyle(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
}

/**
 * Turn IV spell markup into readable text with spell ids for tooling.
 * @param {string} html
 * @returns {string}
 */
export function ivHtmlToPlain(html) {
  let s = stripScriptAndStyle(html)
  for (let pass = 0; pass < 4; pass++) {
    s = s.replace(
      /<span[^>]*data-wowhead="spell=(\d+)"[^>]*>([\s\S]*?)<\/span>/gi,
      (_, id, inner) => {
        const name = ivHtmlToPlain(inner).trim()
        return name ? `${name}[${id}]` : `spell[${id}]`
      }
    )
  }
  s = s.replace(/<[^>]+>/g, ' ')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Remove balanced `<div class="image_block">…</div>` regions (talent/rotation tab widgets).
 * @param {string} html
 * @returns {string}
 */
export function removeImageBlocks(html) {
  const needle = '<div class="image_block">'
  let out = ''
  let pos = 0
  while (pos < html.length) {
    const start = html.indexOf(needle, pos)
    if (start === -1) {
      out += html.slice(pos)
      break
    }
    out += html.slice(pos, start)
    let i = start + needle.length
    let depth = 1
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i)
      const nextClose = html.indexOf('</div>', i)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        i = nextOpen + 4
      } else {
        depth--
        i = nextClose + 6
      }
    }
    pos = i
  }
  return out
}

/**
 * Text before the first interactive image/tab block (page intro only).
 * @param {string} innerHtml from extractPageContentInnerHtml
 * @returns {string}
 */
export function extractIntroBeforeFirstImageBlock(innerHtml) {
  if (!innerHtml) return ''
  const cleaned = stripScriptAndStyle(innerHtml)
  const idx = cleaned.indexOf('<div class="image_block">')
  const slice = idx === -1 ? cleaned : cleaned.slice(0, idx)
  return ivHtmlToPlain(slice)
}

/**
 * Inner HTML of a `<span id="area_N_button">…</span>` (handles nested `<span>` for hero icons).
 */
function sliceBalancedSpanContent(html, spanOpenTagEndIdx) {
  let depth = 1
  let j = spanOpenTagEndIdx
  while (j < html.length && depth > 0) {
    const open = html.indexOf('<span', j)
    const close = html.indexOf('</span>', j)
    if (close === -1) break
    if (open !== -1 && open < close) {
      depth++
      j = open + 5
    } else {
      depth--
      if (depth === 0) return html.slice(spanOpenTagEndIdx, close)
      j = close + 7
    }
  }
  return ''
}

/**
 * Inner HTML of the `<div class="image_block_content" …>` node (balanced child `</div>`).
 */
function sliceBalancedDivInner(html, openDivTagEndIdx) {
  let depth = 1
  let j = openDivTagEndIdx
  while (j < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', j)
    const nextClose = html.indexOf('</div>', j)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      j = nextOpen + 4
    } else {
      depth--
      if (depth === 0) return html.slice(openDivTagEndIdx, nextClose)
      j = nextClose + 6
    }
  }
  return ''
}

/**
 * Map `area_N_button` tab labels (talents page).
 * @param {string} innerHtml
 * @returns {Record<string, string>}
 */

export function extractTalentAreaTabLabels(innerHtml) {
  const cleaned = stripScriptAndStyle(innerHtml)
  const map = {}
  const re = /<span[^>]*id="(area_\d+)_button"[^>]*>/gi
  let m
  while ((m = re.exec(cleaned))) {
    const tagEnd = m.index + m[0].length
    const inner = sliceBalancedSpanContent(cleaned, tagEnd)
    map[m[1]] = ivHtmlToPlain(inner)
  }
  return map
}

/**
 * Map `rotation_tool_block_N_button` labels (rotation page).
 * @param {string} innerHtml
 * @returns {Record<string, string>}
 */
export function extractRotationToolTabLabels(innerHtml) {
  const cleaned = stripScriptAndStyle(innerHtml)
  const map = {}
  const re = /<span[^>]*id="(rotation_tool_block_\d+)_button"[^>]*>/gi
  let m
  while ((m = re.exec(cleaned))) {
    const tagEnd = m.index + m[0].length
    const inner = sliceBalancedSpanContent(cleaned, tagEnd)
    map[m[1]] = ivHtmlToPlain(inner)
  }
  return map
}

/**
 * Every `<div class="image_block_content" id="…">` panel as plain text (rotation + talent widgets).
 * @param {string} innerHtml
 * @returns {Array<{ panelId: string, bodyPlain: string }>}
 */
export function extractAllImageBlockPanels(innerHtml) {
  if (!innerHtml) return []
  const cleaned = stripScriptAndStyle(innerHtml)
  const re = /<div class="image_block_content[^"]*" id="([^"]+)"[^>]*>/gi
  const matches = [...cleaned.matchAll(re)]
  const panels = []
  for (let i = 0; i < matches.length; i++) {
    const id = matches[i][1]
    const openEnd = matches[i].index + matches[i][0].length
    const inner = sliceBalancedDivInner(cleaned, openEnd)
    panels.push({ panelId: id, bodyPlain: ivHtmlToPlain(inner) })
  }
  return panels
}

/**
 * Talent calculator rows: `area_1` … merged with embed hashes from page scripts.
 * @param {string} innerHtml
 * @param {Array<{ targetElementId: string, embedHash: string }>} midnightEmbeds
 * @param {Record<string, string>} tabLabels from extractTalentAreaTabLabels
 * @returns {Array<Record<string, unknown>>}
 */
export function extractRecommendedTalentBuildRows(innerHtml, midnightEmbeds, tabLabels) {
  const cleaned = stripScriptAndStyle(innerHtml)
  const re = /<div class="image_block_content[^"]*" id="(area_\d+)"[^>]*>/gi
  const matches = [...cleaned.matchAll(re)]
  const byEmbedId = new Map(midnightEmbeds.map((e) => [e.targetElementId, e.embedHash]))
  const rows = []
  for (let i = 0; i < matches.length; i++) {
    const areaId = matches[i][1]
    const openEnd = matches[i].index + matches[i][0].length
    const slice = sliceBalancedDivInner(cleaned, openEnd)
    const h3 = slice.match(/<h3[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h3>/i)
    const headingId = h3 ? h3[1] : null
    const titlePlain = h3 ? ivHtmlToPlain(h3[2]) : ''
    const bodyOnly = h3 ? slice.replace(/<h3[\s\S]*?<\/h3>/i, '') : slice
    const notesPlain = ivHtmlToPlain(bodyOnly)
    const n = areaId.replace('area_', '')
    const targetElementId = `midnight-skill-builder-${n}`
    rows.push({
      areaId,
      tabLabel: tabLabels[areaId] ?? null,
      headingId,
      titlePlain,
      notesPlain,
      midnightEmbedHash: byEmbedId.get(targetElementId) ?? null,
      targetElementId,
    })
  }
  return rows
}

/**
 * H2/H3 sections with plain bodies (changelog excluded). Long bodies truncated for oversized tab widgets.
 * @param {string} innerHtml
 * @param {{ stopBeforeChangelog?: boolean, maxBodyChars?: number }} [options]
 * @returns {Array<{ outlineLevel: string, headingLevel: number, id: string, titlePlain: string, bodyPlain: string, truncated: boolean }>}
 */
export function extractIvHeadingSections(innerHtml, options = {}) {
  const { stopBeforeChangelog = true, maxBodyChars = 12_000 } = options
  if (!innerHtml) return []
  let html = stripScriptAndStyle(innerHtml)
  if (stopBeforeChangelog) {
    let cut = html.search(/<h2[^>]*id="changelog"/i)
    if (cut === -1) cut = html.indexOf('changelog_wrapper')
    if (cut === -1)
      cut = html.search(/<div[^>]*class="[^"]*changelog_wrapper/i)
    if (cut !== -1) html = html.slice(0, cut)
  }

  const re =
    /<div class="heading_container heading_number_(\d+)"[^>]*>[\s\S]*?<h(\d)[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\d>/gi
  const matches = [...html.matchAll(re)]
  const sections = []
  for (let i = 0; i < matches.length; i++) {
    const outlineLevel = matches[i][1]
    const headingLevel = parseInt(matches[i][2], 10)
    const id = matches[i][3]
    const titleHtml = matches[i][4]
    const start = matches[i].index + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length
    let bodyHtml = html.slice(start, end)
    let truncated = false
    let bodyPlain = ivHtmlToPlain(bodyHtml)
    if (bodyPlain.length > maxBodyChars) {
      truncated = true
      bodyPlain = `${bodyPlain.slice(0, maxBodyChars)} … [truncated]`
    }
    sections.push({
      outlineLevel,
      headingLevel,
      id,
      titlePlain: ivHtmlToPlain(titleHtml),
      bodyPlain,
      truncated,
    })
  }
  return sections
}

/**
 * @param {string} html
 * @returns {boolean}
 */
export function isBlockedOrErrorHtml(html) {
  return (
    html.length < 800 ||
    /403\s+Forbidden/i.test(html) ||
    /Attention Required/i.test(html) ||
    /Just a moment/i.test(html) ||
    /cf-browser-verification/i.test(html)
  )
}

/**
 * Main prose + widgets for the current guide page (excludes site chrome above/below).
 * @param {string} html
 * @returns {string | null}
 */
export function extractPageContentInnerHtml(html) {
  const startNeedle = '<div class="page_content ">'
  const endNeedle = '<div class="page_content_footer'
  const start = html.indexOf(startNeedle)
  if (start === -1) return null
  const end = html.indexOf(endNeedle, start + startNeedle.length)
  if (end === -1) return null
  return html.slice(start, end)
}

/**
 * Spec/class labels injected on many pages (`window.icyveins.specData`).
 * @param {string} html
 * @returns {{ className: string, specName: string } | null}
 */
export function extractSpecData(html) {
  const m = html.match(
    /"specData"\s*:\s*\{\s*"specName"\s*:\s*"([^"]*)"\s*,\s*"className"\s*:\s*"([^"]*)"\s*\}/
  )
  if (!m) return null
  return { specName: m[1], className: m[2] }
}

/**
 * Guide section nav used in breadcrumb dropdown (`breadcrumb_toc_data = [...]`).
 * @param {string} html
 * @returns {Array<{ title: string, url: string, current?: boolean }>}
 */
export function extractBreadcrumbToc(html) {
  const marker = 'breadcrumb_toc_data = '
  const i = html.indexOf(marker)
  if (i === -1) return []
  let j = i + marker.length
  while (j < html.length && /\s/.test(html[j])) j++
  if (html[j] !== '[') return []

  let depth = 0
  const start = j
  for (; j < html.length; j++) {
    const c = html[j]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        const jsonStr = html.slice(start, j + 1)
        try {
          const parsed = JSON.parse(jsonStr)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }
    }
  }
  return []
}

/**
 * @param {string} url protocol-relative or absolute
 * @returns {string}
 */
export function absoluteIcyVeinsUrl(url) {
  if (!url) return url
  if (url.startsWith('//')) return `https:${url}`
  return url
}

/**
 * First schema.org Article block in ld+json scripts (dateModified, headline, …).
 * @param {string} html
 * @returns {Record<string, unknown> | null}
 */
export function extractArticleJsonLd(html) {
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    const raw = m[1].trim()
    try {
      const obj = JSON.parse(raw)
      if (obj && obj['@type'] === 'Article') return obj
    } catch {
      /* continue */
    }
  }
  return null
}

/**
 * Midnight talent calculator embed hashes (`new MidnightTalentCalculator(...)`).
 * These are site-specific payload strings (often `#AB-…`); pass through to game import only after verifying format.
 * @param {string} html
 * @returns {Array<{ targetElementId: string, embedHash: string }>}
 */
export function extractMidnightTalentEmbedArgs(html) {
  const out = []
  const re =
    /"midnight-skill-builder-(\d+)",\s*(?:\/\/[^\n]*)?\s*\r?\n\s*"([^"]+)"/g
  let m
  while ((m = re.exec(html))) {
    out.push({
      targetElementId: `midnight-skill-builder-${m[1]}`,
      embedHash: m[2],
    })
  }
  return out
}
