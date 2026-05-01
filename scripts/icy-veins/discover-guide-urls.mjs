/**
 * Collect WoW guide URLs linked from the class guides hub (discovery aid for bulk scrapes).
 *
 * Usage: node scripts/icy-veins/discover-guide-urls.mjs
 *
 * Compliance: read https://www.icy-veins.com/robots.txt and site terms before automated crawling.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')

const HUB = 'https://www.icy-veins.com/wow/class-guides'
const UA =
  'Mozilla/5.0 (compatible; ParseAnalyzerGuideSync/0.1; local-dev guide snapshot)'

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

function collectWowPaths(html) {
  const paths = new Set()
  const re = /href="(?:https?:)?\/\/www\.icy-veins\.com\/wow\/([^"#?]+)"/gi
  let m
  while ((m = re.exec(html))) {
    paths.add(m[1])
  }
  return [...paths].sort()
}

async function main() {
  console.log('Fetching', HUB)
  const { html, status, ok } = await fetchHtml(HUB)
  const scrapedAt = new Date().toISOString()
  const paths = ok ? collectWowPaths(html) : []

  const outDir = path.join(root, 'knowledge/icy-veins')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'class-guides-hub-links.json')
  const payload = {
    scrapedAt,
    sourceUrl: HUB,
    fetch: { httpStatus: status, ok },
    pathCount: paths.length,
    paths,
    note:
      'Raw path strings from hub HTML hrefs (deduped). Filter client-side for class/spec guides.',
  }
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n')
  console.log('Wrote', path.relative(root, outPath), '— paths:', paths.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
