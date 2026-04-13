/** True when the URL looks like a Warcraft Logs report compare link (two reports). */
export function isWarcraftLogsCompareUrl(url: string): boolean {
  const t = url.trim()
  if (!t) return false
  try {
    const parsed = new URL(t.startsWith('http') ? t : `https://www.warcraftlogs.com${t}`)
    return /\/reports\/compare\//.test(parsed.pathname)
  } catch {
    return false
  }
}
