/**
 * Decode Blizzard talent export string header (version + specId only).
 * Mirrors lib/talents/decodeTalentString.ts — kept in JS for the scraper without TS compile.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = new Uint8Array(128)
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charCodeAt(i)] = i

function base64ToBytes(str) {
  const clean = str.replace(/[=\s]/g, '')
  const len = clean.length
  const bytes = new Uint8Array(Math.floor((len * 6) / 8))
  let buf = 0
  let bits = 0
  let pos = 0
  for (let i = 0; i < len; i++) {
    const code = clean.charCodeAt(i)
    if (code >= 128) throw new Error('Invalid base64 character')
    buf = (buf << 6) | B64_LOOKUP[code]
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[pos++] = (buf >>> bits) & 0xff
    }
  }
  return bytes.subarray(0, pos)
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes
    this.bitPos = 0
  }

  read(numBits) {
    let value = 0
    for (let i = 0; i < numBits; i++) {
      const byteIdx = Math.floor(this.bitPos / 8)
      const bitIdx = 7 - (this.bitPos % 8)
      if (byteIdx >= this.bytes.length) throw new Error('Unexpected end of talent string')
      value = (value << 1) | ((this.bytes[byteIdx] >>> bitIdx) & 1)
      this.bitPos++
    }
    return value
  }
}

/**
 * @param {string} exportStr Blizzard `/etl` style string (e.g. CAE…)
 * @returns {{ version: number, specId: number }}
 */
export function parseTalentExportHeader(exportStr) {
  const bytes = base64ToBytes(exportStr)
  const reader = new BitReader(bytes)
  const version = reader.read(8)
  const specId = reader.read(16)
  return { version, specId }
}
