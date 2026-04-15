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
  /**
   * Raw `fight` query segment: numeric id, or WCL keywords `last` / `first` (case-insensitive).
   * Resolved to a numeric fight id after the report’s fight list is loaded.
   */
  fightQuery: string
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

/** Minimal fight row from WCL `report.fights` (used to resolve `fight=last` / `first`). */
export type WclReportFightRow = { id: number; startTime: number; endTime: number }

/**
 * Turn `fight=12`, `fight=last`, or `fight=first` into a concrete WCL fight id.
 */
export function resolveReportFightQuery(fights: WclReportFightRow[], fightQuery: string): number {
  const q = fightQuery.trim()
  if (!q) throw new Error('Fight selector is empty.')
  if (!fights.length) throw new Error('This report has no fights.')

  if (/^\d+$/.test(q)) {
    const id = parseInt(q, 10)
    if (!fights.some(f => f.id === id)) {
      const ids = fights.map(f => f.id).join(', ')
      throw new Error(`Fight ${id} not found. Available fight IDs: ${ids}`)
    }
    return id
  }

  const key = q.toLowerCase()
  if (key === 'last') {
    const sorted = [...fights].sort((a, b) => b.endTime - a.endTime)
    return sorted[0].id
  }
  if (key === 'first') {
    const sorted = [...fights].sort((a, b) => a.startTime - b.startTime)
    return sorted[0].id
  }

  throw new Error(
    `Unknown fight value “${q}”. Use a numeric fight id, or WCL’s last or first (e.g. ?fight=last).`,
  )
}

/**
 * Parse a Warcraft Logs compare URL or a single-report URL.
 * Single-report URLs need `?fight=` with a numeric id, last, or first.
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
  const fightQuery = fightRaw.split(',')[0]?.trim() || ''
  if (!fightQuery) {
    throw new Error(
      'Single-report URLs need ?fight= (numeric id, last, or first). Copy the URL from Warcraft Logs while viewing the fight.',
    )
  }

  const source = (u.searchParams.get('source') || '').trim()
  return { kind: 'report', code, fightQuery, source }
}
