/**
 * Fetch Frost Mage Wowhead guides and write structured JSON under knowledge/wowhead/scraped/.
 *
 * Usage: node scripts/wowhead/scrape-frost-mage.mjs
 *
 * Important:
 * - Respect https://www.wowhead.com/robots.txt and Wowhead Terms of Use before bulk / automated use.
 * - Run sparingly; prefer committing scraped JSON as snapshots for the app to read offline.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractGuideBodyMarkup } from './extractGuideMarkup.mjs'
import { extractTalentData, splitBbCodeSections } from './parseTalentBbCode.mjs'
import {
  extractBbCodeDbFlavor,
  extractBbCodeSeasonBanner,
  extractGuideHeaderUpdatedDate,
  extractGuideNumericId,
  extractSidebarPatchLabel,
  isBlockedOrErrorHtml,
} from './extractWowheadChrome.mjs'
import { parseTalentExportHeader } from './talentExportHeader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')
const outDir = path.join(root, 'knowledge/wowhead/scraped/mage-frost')

const UA =
  'Mozilla/5.0 (compatible; ParseAnalyzerGuideSync/0.1; local-dev guide snapshot)'

const PAGES = [
  {
    key: 'talent-builds',
    url: 'https://www.wowhead.com/guide/classes/mage/frost/talent-builds-pve-dps',
  },
  {
    key: 'rotation-cooldowns',
    url: 'https://www.wowhead.com/guide/classes/mage/frost/rotation-cooldowns-pve-dps',
  },
]

/**
 * @returns {Promise<{ html: string, status: number, ok: boolean }>}
 */
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

function buildSnapshotMeta({
  url,
  fetchResult,
  markup,
  talentCodes,
  scrapedAt,
  expectedWowSpecId,
}) {
  const html = fetchResult.html
  const blocked = isBlockedOrErrorHtml(html)
  const sidebarPatch = extractSidebarPatchLabel(html)
  const headerUpdated = extractGuideHeaderUpdatedDate(html)
  const guideRef = extractGuideNumericId(html)
  const dbFlavor = markup ? extractBbCodeDbFlavor(markup) : null
  const seasonBanner = markup ? extractBbCodeSeasonBanner(markup) : null

  const talentHeaders = []
  for (const code of talentCodes) {
    try {
      const h = parseTalentExportHeader(code)
      talentHeaders.push({
        importCodePrefix: `${code.slice(0, 12)}…`,
        blizzardExportSerializationVersion: h.version,
        specIdFromExport: h.specId,
        sourcedFrom:
          'Decoded from Base64 payload header (8-bit version, 16-bit specId) per Blizzard export format; same as lib/talents/decodeTalentString.ts parseTalentStringHeader',
      })
    } catch {
      talentHeaders.push({
        importCodePrefix: `${code.slice(0, 12)}…`,
        error: 'could not decode header',
      })
    }
  }

  let talentHeaderVsGuideWarning = null
  if (expectedWowSpecId != null && talentCodes.length > 0) {
    try {
      const h = parseTalentExportHeader(talentCodes[0])
      if (h.specId !== expectedWowSpecId) {
        talentHeaderVsGuideWarning =
          `parseTalentStringHeader on this Wowhead export yields specId ${h.specId}, not ChrSpecialization id ${expectedWowSpecId} for Frost. Treat header fields as raw Blizzard bit layout — see __tests__/lib/talents/decodeTalentString.ts (Wowhead CAE sample).`
      }
    } catch {
      /* ignore */
    }
  }

  return {
    scrapedAt,
    sourcePageUrl: url,
    fetch: {
      httpStatus: fetchResult.status,
      ok: fetchResult.ok && !blocked,
      blockedByCdn: blocked,
      note:
        blocked || !fetchResult.ok
          ? 'No reliable snapshot — CloudFront/WAF or HTTP error. Use a browser export of HTML or retry from another network.'
          : undefined,
    },
    wowheadDeclaredEdition: {
      /** Present on many retail guides; author-facing patch label, not the same as a unique Blizzard build id. */
      patchLabel: sidebarPatch,
      guideLastUpdated: headerUpdated,
      guide: guideRef,
    },
    bbcodeSignals: {
      ...(dbFlavor ? { dbFlavor } : {}),
      ...(seasonBanner ? { seasonBanner } : {}),
    },
    blizzardTalentExports: talentHeaders.length ? { samples: talentHeaders } : {},
    talentHeaderVsGuideWarning,
    howToStayCurrent: {
      refreshProcedure:
        'Re-run `npm run scrape-wowhead-frost` when guides change; commit new JSON. Wowhead "Updated" date + sidebar patch are the closest HTML-native freshness signals.',
      notInHtml:
        'Official WoW client build number is not embedded in the fetched guide HTML; compare in-game or Blizzard patch notes if you need that precision.',
    },
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const scrapedAt = new Date().toISOString()

  for (const page of PAGES) {
    console.log('Fetching', page.url)
    const fetchResult = await fetchHtml(page.url)
    const { html } = fetchResult
    const markup = extractGuideBodyMarkup(html)
    if (!markup) {
      console.warn('No guide-body markup found for', page.key)
      const snap = buildSnapshotMeta({
        url: page.url,
        fetchResult,
        markup: '',
        talentCodes: [],
        scrapedAt,
        expectedWowSpecId: null,
      })
      fs.writeFileSync(
        path.join(outDir, `${page.key}.snapshot-error.json`),
        JSON.stringify(snap, null, 2) + '\n'
      )
      continue
    }

    const base = {
      sourceUrl: page.url,
      scrapedAt,
      game: 'wow-retail',
      classSlug: 'mage',
      specSlug: 'frost',
      wowSpecId: 64,
      markupLength: markup.length,
    }

    if (page.key === 'talent-builds') {
      const talent = extractTalentData(markup)
      const uniqueImportCodes = [...new Set(talent.copies.map((c) => c.importCode))]
      const snapshot = buildSnapshotMeta({
        url: page.url,
        fetchResult,
        markup,
        talentCodes: uniqueImportCodes.slice(0, 2),
        scrapedAt,
        expectedWowSpecId: 64,
      })
      const payload = {
        ...base,
        pageType: 'talent-builds',
        snapshot,
        talentCopies: talent.copies,
        talentCalcReferences: talent.talentCalcRefs,
        /** Canonical import strings deduped (copy buttons preferred order) */
        uniqueImportCodes,
      }
      fs.writeFileSync(path.join(outDir, 'talent-builds.json'), JSON.stringify(payload, null, 2) + '\n')
      console.log('Wrote talent-builds.json — copy rows:', talent.copies.length, 'codes:', payload.uniqueImportCodes.length)
    }

    if (page.key === 'rotation-cooldowns') {
      const sections = splitBbCodeSections(markup)
      const snapshot = buildSnapshotMeta({
        url: page.url,
        fetchResult,
        markup,
        talentCodes: [],
        scrapedAt,
        expectedWowSpecId: null,
      })
      const payload = {
        ...base,
        pageType: 'rotation-cooldowns',
        snapshot,
        sections,
        /** Full BBCode article for archival / future NLP */
        markupBbCode: markup,
      }
      fs.writeFileSync(path.join(outDir, 'rotation-cooldowns.json'), JSON.stringify(payload, null, 2) + '\n')
      console.log('Wrote rotation-cooldowns.json — sections:', sections.length, 'markup chars:', markup.length)
    }
  }

  console.log('Done →', path.relative(root, outDir))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
