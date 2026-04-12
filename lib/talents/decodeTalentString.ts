/**
 * Decodes a WoW talent export string (Base64-encoded bit stream) into
 * a specId + per-node selection map.
 *
 * Format reference: Blizzard_ClassTalentImportExport.lua
 * Header: version (8 bits) + specId (16 bits) + treeHash (128 bits) = 152 bits
 * Body: one entry per tree node in ascending nodeId order, variable-length bits.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = new Uint8Array(128)
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charCodeAt(i)] = i

function base64ToBytes(str: string): Uint8Array {
  const clean = str.replace(/[=\s]/g, '')
  const len = clean.length
  const bytes = new Uint8Array(Math.floor(len * 6 / 8))
  let buf = 0, bits = 0, pos = 0
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
  private bytes: Uint8Array
  private bitPos = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  read(numBits: number): number {
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

  get position(): number {
    return this.bitPos
  }
}

export interface TalentStringHeader {
  version: number
  specId: number
}

export interface DecodedTalentNode {
  rank: number
  choiceIndex?: number
}

export interface DecodedTalentString {
  specId: number
  version: number
  nodes: Map<number, DecodedTalentNode>
}

export interface TreeNodeInfo {
  nodeId: number
  nodeType: string
  maxRanks: number
}

/**
 * Parse only the header (specId + version) without needing tree metadata.
 * Useful for auto-detecting which tree to fetch before full decode.
 */
export function parseTalentStringHeader(exportStr: string): TalentStringHeader {
  const bytes = base64ToBytes(exportStr)
  const reader = new BitReader(bytes)
  const version = reader.read(8)
  const specId = reader.read(16)
  return { version, specId }
}

/**
 * Fully decode a talent export string against an ordered list of tree nodes.
 * treeNodes must be sorted by nodeId ascending (matching Blizzard's iteration order).
 */
export function decodeTalentString(
  exportStr: string,
  treeNodes: TreeNodeInfo[]
): DecodedTalentString {
  const bytes = base64ToBytes(exportStr)
  const reader = new BitReader(bytes)

  const version = reader.read(8)
  const specId = reader.read(16)

  // Skip 128-bit tree hash
  reader.read(64)
  reader.read(64)

  const nodes = new Map<number, DecodedTalentNode>()

  for (const node of treeNodes) {
    const isSelected = reader.read(1)
    if (!isSelected) continue

    const isPurchased = reader.read(1)
    if (!isPurchased) {
      nodes.set(node.nodeId, { rank: 1 })
      continue
    }

    let rank = node.maxRanks
    const isPartiallyRanked = reader.read(1)
    if (isPartiallyRanked) {
      rank = reader.read(6)
    }

    const isChoiceNode = reader.read(1)
    let choiceIndex: number | undefined
    if (isChoiceNode) {
      choiceIndex = reader.read(2)
    }

    nodes.set(node.nodeId, { rank, choiceIndex })
  }

  return { specId, version, nodes }
}
