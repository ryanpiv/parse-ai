/**
 * Fetch Unholy Death Knight Icy Veins talents + rotation pages and write structured JSON.
 *
 * - Talents: https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-spec-builds-talents
 * - Rotation: https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-rotation-cooldowns-abilities
 *
 * Usage: node scripts/icy-veins/scrape-unholy-dk.mjs
 *
 * Compliance: read https://www.icy-veins.com/robots.txt and Icy Veins Terms before bulk use.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  absoluteIcyVeinsUrl,
  extractAllImageBlockPanels,
  extractArticleJsonLd,
  extractBreadcrumbToc,
  extractIntroBeforeFirstImageBlock,
  extractIvHeadingSections,
  extractMidnightTalentEmbedArgs,
  extractPageContentInnerHtml,
  extractRecommendedTalentBuildRows,
  extractRotationToolTabLabels,
  extractSpecData,
  extractTalentAreaTabLabels,
  isBlockedOrErrorHtml,
  removeImageBlocks,
} from './extractIcyVeinsChrome.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')
const outDir = path.join(root, 'knowledge/icy-veins/scraped/death-knight-unholy')

const UA =
  'Mozilla/5.0 (compatible; ParseAnalyzerGuideSync/0.1; local-dev guide snapshot)'

const TALENTS_URL =
  'https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-spec-builds-talents'
const ROTATION_URL =
  'https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-rotation-cooldowns-abilities'

const PAGES = [
  {
    key: 'spec-builds-talents',
    kind: 'talents',
    url: TALENTS_URL,
  },
  {
    key: 'rotation-cooldowns-abilities',
    kind: 'rotation',
    url: ROTATION_URL,
  },
]

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  const html = await r.text()
  return { html, status: r.status, ok: r.ok }
}

function articleAuthorName(articleLd) {
  if (!articleLd?.author) return null
  const a = articleLd.author
  if (typeof a === 'string') return a
  if (typeof a === 'object' && a && 'name' in a && typeof a.name === 'string') return a.name
  return null
}

function buildSnapshotMeta({ url, fetchResult, scrapedAt, articleLd, pageKind }) {
  const html = fetchResult.html
  const blocked = isBlockedOrErrorHtml(html)
  const howTo = {
    refreshProcedure:
      'Re-run `npm run scrape-icy-veins-unholy` when guides change; commit JSON under knowledge/icy-veins/scraped/death-knight-unholy/.',
  }
  if (pageKind === 'talents') {
    howTo.talentEmbeds =
      'Midnight `#AB-…` strings power IV’s embedded calculator on the talents page; verify against in-game import before treating as a raw Blizzard export.'
  }
  return {
    scrapedAt,
    sourcePageUrl: url,
    fetch: {
      httpStatus: fetchResult.status,
      ok: fetchResult.ok && !blocked,
      blockedOrEmpty: blocked,
      note: blocked
        ? 'Unusable snapshot — short body, challenge page, or error HTML.'
        : undefined,
    },
    icyVeinsArticle: articleLd
      ? {
          headline: articleLd.headline ?? null,
          dateModified: articleLd.dateModified ?? null,
          datePublished: articleLd.datePublished ?? null,
          authorName: articleAuthorName(articleLd),
          description: articleLd.description ?? null,
        }
      : {},
    howToStayCurrent: howTo,
  }
}

function pickRelatedGuideUrls(breadcrumbToc) {
  const abs = (u) => (u ? absoluteIcyVeinsUrl(u) : null)
  let canonicalBuildsAndTalents = null
  let canonicalRotationCooldowns = null
  for (const item of breadcrumbToc) {
    const t = item.title.toLowerCase()
    if (t.includes('build') && t.includes('talent')) canonicalBuildsAndTalents = abs(item.url)
    if (t.includes('rotation') && t.includes('cooldown')) canonicalRotationCooldowns = abs(item.url)
  }
  return { canonicalBuildsAndTalents, canonicalRotationCooldowns }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const scrapedAt = new Date().toISOString()

  const combined = {
    source: 'icy-veins',
    scrapedAt,
    game: 'wow-retail',
    classSlug: 'death-knight',
    specSlug: 'unholy',
    canonicalPages: {
      talents: TALENTS_URL,
      rotation: ROTATION_URL,
    },
    pages: {},
  }

  for (const page of PAGES) {
    console.log('Fetching', page.url)
    const fetchResult = await fetchHtml(page.url)
    const { html } = fetchResult
    const articleLd = extractArticleJsonLd(html)
    const snapshot = buildSnapshotMeta({
      url: page.url,
      fetchResult,
      scrapedAt,
      articleLd,
      pageKind: page.kind,
    })
    const inner = extractPageContentInnerHtml(html)
    const breadcrumbToc = extractBreadcrumbToc(html).map((item) => ({
      ...item,
      url: item.url ? absoluteIcyVeinsUrl(item.url) : item.url,
    }))
    const relatedGuideUrls = pickRelatedGuideUrls(breadcrumbToc)
    const specData = extractSpecData(html)

    /** @type {Record<string, unknown>} */
    let payload

    if (page.kind === 'talents') {
      const midnightEmbeds = extractMidnightTalentEmbedArgs(html)
      const tabLabels = extractTalentAreaTabLabels(inner ?? '')
      const recommendedTalentBuilds = extractRecommendedTalentBuildRows(
        inner ?? '',
        midnightEmbeds,
        tabLabels
      )
      const proseSections = extractIvHeadingSections(removeImageBlocks(inner ?? ''))
      payload = {
        sourceUrl: page.url,
        pageKey: page.key,
        pageType: 'spec-builds-talents',
        snapshot,
        specData,
        relatedGuideUrls,
        introPlain: extractIntroBeforeFirstImageBlock(inner ?? ''),
        recommendedTalentBuilds,
        proseSections,
      }
    } else {
      const rotationTabLabels = extractRotationToolTabLabels(inner ?? '')
      const panels = extractAllImageBlockPanels(inner ?? '').map((p) => ({
        panelId: p.panelId,
        tabLabel: rotationTabLabels[p.panelId] ?? null,
        panelKind: p.panelId.startsWith('rotation_tool_block_')
          ? 'rotation_tab'
          : /^area_[a-z]$/i.test(p.panelId)
            ? 'topic_tab'
            : 'other',
        bodyPlain: p.bodyPlain,
      }))
      const headingSections = extractIvHeadingSections(inner ?? '', { maxBodyChars: 12_000 })
      payload = {
        sourceUrl: page.url,
        pageKey: page.key,
        pageType: 'rotation-cooldowns-abilities',
        snapshot,
        specData,
        relatedGuideUrls,
        introPlain: extractIntroBeforeFirstImageBlock(inner ?? ''),
        imageBlockPanels: panels,
        headingSections,
      }
    }

    combined.pages[page.key] = {
      sourceUrl: page.url,
      snapshotMetaOnly: {
        fetch: snapshot.fetch,
        icyVeinsArticle: snapshot.icyVeinsArticle,
      },
    }

    fs.writeFileSync(path.join(outDir, `${page.key}.json`), JSON.stringify(payload, null, 2) + '\n')
    console.log('  wrote', page.key + '.json')
  }

  fs.writeFileSync(path.join(outDir, '_index.json'), JSON.stringify(combined, null, 2) + '\n')
  console.log('Done →', path.relative(root, outDir))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
