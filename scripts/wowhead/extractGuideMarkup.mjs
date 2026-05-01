/**
 * Wowhead retail guides embed article BBCode inside:
 *   WH.markup.printHtml("....escaped....", "guide-body", {...});
 * Extract and unescape the first argument when the second is "guide-body".
 */

const GUIDE_BODY_MARKER = '", "guide-body"'

export function unescapeJsStringLiteral(raw) {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c !== '\\') {
      out += c
      continue
    }
    const n = raw[++i]
    if (n === 'n') out += '\n'
    else if (n === 'r') out += '\r'
    else if (n === 't') out += '\t'
    else if (n === '\\') out += '\\'
    else if (n === '"') out += '"'
    else if (n === '/') out += '/'
    else if (n === undefined) out += '\\'
    else out += '\\' + n
  }
  return out.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * @param {string} html full page HTML
 * @returns {string | null}
 */
export function extractGuideBodyMarkup(html) {
  const idx = html.indexOf(GUIDE_BODY_MARKER)
  if (idx === -1) return null
  const before = html.slice(0, idx)
  const startNeedle = 'WH.markup.printHtml("'
  const start = before.lastIndexOf(startNeedle)
  if (start === -1) return null
  const raw = before.slice(start + startNeedle.length)
  return unescapeJsStringLiteral(raw)
}
