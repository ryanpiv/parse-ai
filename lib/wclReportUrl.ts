/** Parsed Warcraft Logs compare URL (two reports). */
export type WclParsedCompare = {
  kind: 'compare'
  r1: string
  r2: string
  f1id: number
  f2id: number
  src1: string
  src2: string
}

/** Parsed single-report URL (?fight= required). */
export type WclParsedReport = {
  kind: 'report'
  code: string
  fightId: number
  /** `source` query: player id or name; empty if absent */
  source: string
}

export type WclParsedUrl = WclParsedCompare | WclParsedReport

function toAbsUrl(raw: string): string {
  const t = raw.trim()
  if (!t) throw new Error('URL is empty')
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  const path = t.startsWith('/') ? t : `/${t}`
  return `https://www.warcraftlogs.com${path}`
}

/**
 * Parse a Warcraft Logs compare URL or a single-report URL.
 * Single-report URLs must include `?fight=<id>` (same as the site uses).
 */
export function parseWclUrl(raw: string): WclParsedUrl {
  const href = toAbsUrl(raw)
  const u = new URL(href)

  const compareMatch = href.match(/\/reports\/compare\/([^/]+)\/([^/?#]+)/)
  if (compareMatch) {
    const r1 = compareMatch[1]
    const r2 = compareMatch[2]
    const fights = (u.searchParams.get('fight') || '').split(',').map(s => s.trim()).filter(Boolean)
    const f1id = parseInt(fights[0] || '', 10)
    const f2id = parseInt(fights[1] || fights[0] || '', 10)
    if (!Number.isFinite(f1id) || !Number.isFinite(f2id)) {
      throw new Error('Compare URL needs fight IDs (?fight=1,2 or ?fight=1).')
    }
    const srcs = (u.searchParams.get('source') || '').split(',').map(s => s.trim())
    const src1 = srcs[0] || ''
    const src2 = srcs[1] || srcs[0] || ''
    return { kind: 'compare', r1, r2, f1id, f2id, src1, src2 }
  }

  const reportMatch = href.match(/\/reports\/([a-z0-9]+)/i)
  if (!reportMatch) {
    throw new Error('Expected a Warcraft Logs URL containing /reports/<code> or /reports/compare/…')
  }
  const code = reportMatch[1]
  if (code.toLowerCase() === 'compare') {
    throw new Error('That URL is not a valid single-report link.')
  }

  const fightRaw = u.searchParams.get('fight') || ''
  const fightFirst = fightRaw.split(',')[0]?.trim() || ''
  const fightId = parseInt(fightFirst, 10)
  if (!Number.isFinite(fightId) || fightId <= 0) {
    throw new Error('Single-report URLs need a fight id (?fight=<id>). Open the fight on Warcraft Logs and copy the URL from the address bar.')
  }

  const source = (u.searchParams.get('source') || '').trim()
  return { kind: 'report', code, fightId, source }
}
