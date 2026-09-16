/**
 * Fetch Wowhead class guides for one or more specs and write structured JSON
 * snapshots under knowledge/wowhead/scraped/<spec-folder>/.
 *
 * Usage:
 *   node scripts/wowhead/scrape-wowhead.mjs mage-frost mage-arcane
 *   node scripts/wowhead/scrape-wowhead.mjs --all
 *
 * Adding a spec = one entry in SPECS below (ChrSpecialization id + Wowhead
 * class/spec URL slugs), then import the JSON in lib/knowledge/embeddedWowhead.ts.
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

const UA =
  'Mozilla/5.0 (compatible; ParseAnalyzerGuideSync/0.1; local-dev guide snapshot)'

/**
 * Registry of scrapable specs. Key = output folder under knowledge/wowhead/scraped/.
 * wowSpecId is the ChrSpecialization id (matches talentDiff.specId in the app).
 * urlSuffix matches Wowhead's role-specific guide slugs: pve-dps / pve-healer / pve-tank.
 */
function spec(classSlug, specSlug, wowSpecId, label, role = 'dps') {
  return { classSlug, specSlug, wowSpecId, label, urlSuffix: `pve-${role}` }
}

const SPECS = {
  'death-knight-blood': spec('death-knight', 'blood', 250, 'Blood Death Knight', 'tank'),
  'death-knight-frost': spec('death-knight', 'frost', 251, 'Frost Death Knight'),
  'death-knight-unholy': spec('death-knight', 'unholy', 252, 'Unholy Death Knight'),
  'demon-hunter-devourer': spec('demon-hunter', 'devourer', 1480, 'Devourer Demon Hunter'),
  'demon-hunter-havoc': spec('demon-hunter', 'havoc', 577, 'Havoc Demon Hunter'),
  'demon-hunter-vengeance': spec('demon-hunter', 'vengeance', 581, 'Vengeance Demon Hunter', 'tank'),
  'druid-balance': spec('druid', 'balance', 102, 'Balance Druid'),
  'druid-feral': spec('druid', 'feral', 103, 'Feral Druid'),
  'druid-guardian': spec('druid', 'guardian', 104, 'Guardian Druid', 'tank'),
  'druid-restoration': spec('druid', 'restoration', 105, 'Restoration Druid', 'healer'),
  'evoker-devastation': spec('evoker', 'devastation', 1467, 'Devastation Evoker'),
  'evoker-preservation': spec('evoker', 'preservation', 1468, 'Preservation Evoker', 'healer'),
  'evoker-augmentation': spec('evoker', 'augmentation', 1473, 'Augmentation Evoker'),
  'hunter-beast-mastery': spec('hunter', 'beast-mastery', 253, 'Beast Mastery Hunter'),
  'hunter-marksmanship': spec('hunter', 'marksmanship', 254, 'Marksmanship Hunter'),
  'hunter-survival': spec('hunter', 'survival', 255, 'Survival Hunter'),
  'mage-arcane': spec('mage', 'arcane', 62, 'Arcane Mage'),
  'mage-fire': spec('mage', 'fire', 63, 'Fire Mage'),
  'mage-frost': spec('mage', 'frost', 64, 'Frost Mage'),
  'monk-brewmaster': spec('monk', 'brewmaster', 268, 'Brewmaster Monk', 'tank'),
  'monk-mistweaver': spec('monk', 'mistweaver', 270, 'Mistweaver Monk', 'healer'),
  'monk-windwalker': spec('monk', 'windwalker', 269, 'Windwalker Monk'),
  'paladin-holy': spec('paladin', 'holy', 65, 'Holy Paladin', 'healer'),
  'paladin-protection': spec('paladin', 'protection', 66, 'Protection Paladin', 'tank'),
  'paladin-retribution': spec('paladin', 'retribution', 70, 'Retribution Paladin'),
  'priest-discipline': spec('priest', 'discipline', 256, 'Discipline Priest', 'healer'),
  'priest-holy': spec('priest', 'holy', 257, 'Holy Priest', 'healer'),
  'priest-shadow': spec('priest', 'shadow', 258, 'Shadow Priest'),
  'rogue-assassination': spec('rogue', 'assassination', 259, 'Assassination Rogue'),
  'rogue-outlaw': spec('rogue', 'outlaw', 260, 'Outlaw Rogue'),
  'rogue-subtlety': spec('rogue', 'subtlety', 261, 'Subtlety Rogue'),
  'shaman-elemental': spec('shaman', 'elemental', 262, 'Elemental Shaman'),
  'shaman-enhancement': spec('shaman', 'enhancement', 263, 'Enhancement Shaman'),
  'shaman-restoration': spec('shaman', 'restoration', 264, 'Restoration Shaman', 'healer'),
  'warlock-affliction': spec('warlock', 'affliction', 265, 'Affliction Warlock'),
  'warlock-demonology': spec('warlock', 'demonology', 266, 'Demonology Warlock'),
  'warlock-destruction': spec('warlock', 'destruction', 267, 'Destruction Warlock'),
  'warrior-arms': spec('warrior', 'arms', 71, 'Arms Warrior'),
  'warrior-fury': spec('warrior', 'fury', 72, 'Fury Warrior'),
  'warrior-protection': spec('warrior', 'protection', 73, 'Protection Warrior', 'tank'),
}

function pagesFor(spec) {
  const base = `https://www.wowhead.com/guide/classes/${spec.classSlug}/${spec.specSlug}`
  return [
    { key: 'talent-builds', url: `${base}/talent-builds-${spec.urlSuffix}` },
    { key: 'rotation-cooldowns', url: `${base}/rotation-cooldowns-${spec.urlSuffix}` },
  ]
}

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

function buildSnapshotMeta({ url, fetchResult, markup, talentCodes, scrapedAt, spec, checkSpecId }) {
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
  if (checkSpecId && talentCodes.length > 0) {
    try {
      const h = parseTalentExportHeader(talentCodes[0])
      if (h.specId !== spec.wowSpecId) {
        talentHeaderVsGuideWarning =
          `parseTalentStringHeader on this Wowhead export yields specId ${h.specId}, not ChrSpecialization id ${spec.wowSpecId} for ${spec.label}. Treat header fields as raw Blizzard bit layout — see __tests__/lib/talents/decodeTalentString.ts (Wowhead CAE sample).`
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
        'Re-run `npm run scrape-wowhead -- <spec-folder>` when guides change; commit new JSON. Wowhead "Updated" date + sidebar patch are the closest HTML-native freshness signals.',
      notInHtml:
        'Official WoW client build number is not embedded in the fetched guide HTML; compare in-game or Blizzard patch notes if you need that precision.',
    },
  }
}

async function scrapeSpec(folder, spec) {
  const outDir = path.join(root, 'knowledge/wowhead/scraped', folder)
  fs.mkdirSync(outDir, { recursive: true })
  const scrapedAt = new Date().toISOString()

  let first = true
  for (const page of pagesFor(spec)) {
    if (!first) await new Promise((r) => setTimeout(r, 400))
    first = false
    console.log('Fetching', page.url)
    const fetchResult = await fetchHtml(page.url)
    const { html } = fetchResult
    const markup = extractGuideBodyMarkup(html)
    if (!markup) {
      console.warn('No guide-body markup found for', folder, page.key)
      const snap = buildSnapshotMeta({
        url: page.url,
        fetchResult,
        markup: '',
        talentCodes: [],
        scrapedAt,
        spec,
        checkSpecId: false,
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
      classSlug: spec.classSlug,
      specSlug: spec.specSlug,
      wowSpecId: spec.wowSpecId,
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
        spec,
        checkSpecId: true,
      })
      const payload = {
        ...base,
        pageType: 'talent-builds',
        snapshot,
        talentCopies: talent.copies,
        talentCalcReferences: talent.talentCalcRefs,
        uniqueImportCodes,
      }
      fs.writeFileSync(path.join(outDir, 'talent-builds.json'), JSON.stringify(payload, null, 2) + '\n')
      console.log('Wrote', folder, 'talent-builds.json — copy rows:', talent.copies.length, 'codes:', payload.uniqueImportCodes.length)
    }

    if (page.key === 'rotation-cooldowns') {
      const sections = splitBbCodeSections(markup)
      const snapshot = buildSnapshotMeta({
        url: page.url,
        fetchResult,
        markup,
        talentCodes: [],
        scrapedAt,
        spec,
        checkSpecId: false,
      })
      // markupBbCode omitted: `sections` is the same content split up, and the
      // raw duplicate would double what webpack bundles client-side per spec.
      const payload = {
        ...base,
        pageType: 'rotation-cooldowns',
        snapshot,
        sections,
      }
      fs.writeFileSync(path.join(outDir, 'rotation-cooldowns.json'), JSON.stringify(payload, null, 2) + '\n')
      console.log('Wrote', folder, 'rotation-cooldowns.json — sections:', sections.length, 'markup chars:', markup.length)
    }
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const wanted = args.includes('--all') ? Object.keys(SPECS) : args
  if (wanted.length === 0) {
    console.error('Usage: node scripts/wowhead/scrape-wowhead.mjs <spec-folder…|--all>')
    console.error('Known specs:', Object.keys(SPECS).join(', '))
    process.exit(1)
  }
  for (const folder of wanted) {
    const spec = SPECS[folder]
    if (!spec) {
      console.error(`Unknown spec "${folder}". Known:`, Object.keys(SPECS).join(', '))
      process.exit(1)
    }
    await scrapeSpec(folder, spec)
    // Polite pacing for bulk runs.
    if (wanted.length > 1) await new Promise((r) => setTimeout(r, 500))
  }
  console.log('Done →', wanted.map((w) => `knowledge/wowhead/scraped/${w}`).join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
