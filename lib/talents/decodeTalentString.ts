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

/**
 * First byte of the export payload (Blizzard serialization version).
 * Must match the live client / Wowhead calculator or sites show “older game version”.
 * Midnight-era strings (e.g. Wowhead talent-calc paths) use 16 — verify with
 * parseTalentStringHeader on a fresh in-game `/etl` export after major patches.
 */
export const TALENT_EXPORT_SERIALIZATION_VERSION = 16

class BitWriter {
  private bits: number[] = []

  writeBit(bit: number): void {
    this.bits.push(bit & 1)
  }

  /** Write `n` bits of `value`, MSB first (same order as BitReader.read). */
  writeBits(value: number, n: number): void {
    for (let i = n - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1)
    }
  }

  /** Pad with zeros to a byte boundary, then pack into bytes. */
  toBytes(): Uint8Array {
    const bits = [...this.bits]
    while (bits.length % 8 !== 0) bits.push(0)
    const bytes = new Uint8Array(bits.length / 8)
    for (let i = 0; i < bytes.length; i++) {
      let b = 0
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j]
      bytes[i] = b
    }
    return bytes
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    const triplet = (b0 << 16) | (b1 << 8) | b2
    result += B64[(triplet >> 18) & 0x3f]
    result += B64[(triplet >> 12) & 0x3f]
    result += i + 1 < bytes.length ? B64[(triplet >> 6) & 0x3f] : '='
    result += i + 2 < bytes.length ? B64[triplet & 0x3f] : '='
  }
  return result
}

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

/**
 * Encode a talent export string from node selections and the same tree ordering as decode.
 * Tree hash is zero-filled (same as many third-party tools).
 */
export function encodeTalentString(options: {
  specId: number
  version?: number
  /**
   * If set, use the 8-bit serialization version from this export’s header (not specId).
   * Keeps synthesized strings aligned with a reference `/etl` string when the constant lags a patch.
   * Playable specId always comes from `specId` so `/api/blizzard-tree` still resolves.
   */
  versionFromExport?: string
  treeNodes: TreeNodeInfo[]
  nodes: Map<number, DecodedTalentNode>
}): string {
  let version = options.version ?? TALENT_EXPORT_SERIALIZATION_VERSION
  const ref = options.versionFromExport?.trim()
  if (ref) {
    try {
      version = parseTalentStringHeader(ref).version
    } catch {
      /* keep version from options/default */
    }
  }
  const { specId, treeNodes, nodes } = options
  const sorted = [...treeNodes].sort((a, b) => a.nodeId - b.nodeId)
  const w = new BitWriter()
  w.writeBits(version, 8)
  w.writeBits(specId, 16)
  w.writeBits(0, 64)
  w.writeBits(0, 64)

  for (const node of sorted) {
    const sel = nodes.get(node.nodeId)
    if (!sel || sel.rank <= 0) {
      w.writeBit(0)
      continue
    }

    const isChoice = node.nodeType === 'CHOICE'

    // Granted at rank 1 (non-choice, single-rank nodes)
    if (!isChoice && node.maxRanks === 1 && sel.rank === 1 && sel.choiceIndex === undefined) {
      w.writeBit(1)
      w.writeBit(0)
      continue
    }

    w.writeBit(1)
    w.writeBit(1)

    if (isChoice) {
      const idx =
        sel.choiceIndex !== undefined && sel.choiceIndex !== null
          ? sel.choiceIndex & 3
          : Math.max(0, Math.min(sel.rank - 1, 3))
      if (sel.rank < node.maxRanks) {
        w.writeBit(1)
        w.writeBits(sel.rank, 6)
      } else {
        w.writeBit(0)
      }
      w.writeBit(1)
      w.writeBits(idx, 2)
    } else {
      if (sel.rank >= node.maxRanks) {
        w.writeBit(0)
        w.writeBit(0)
      } else {
        w.writeBit(1)
        w.writeBits(sel.rank, 6)
        w.writeBit(0)
      }
    }
  }

  return bytesToBase64(w.toBytes())
}

/**
 * Map WCL talent rows (nodeID + rank) into decoder-shaped selections for encode.
 * CHOICE nodes: rank 1..N maps to choice index rank-1; full pick uses rank >= maxRanks.
 */
export function wclRowsToDecodedNodes(
  rows: Array<{ nodeID: number; rank: number }>,
  treeNodes: TreeNodeInfo[]
): Map<number, DecodedTalentNode> {
  const byId = new Map<number, TreeNodeInfo>()
  for (const n of treeNodes) byId.set(n.nodeId, n)
  const m = new Map<number, DecodedTalentNode>()
  for (const r of rows) {
    if (r.rank <= 0) continue
    const node = byId.get(r.nodeID)
    if (!node) continue
    if (node.nodeType === 'CHOICE') {
      const ci = Math.max(0, Math.min(r.rank - 1, 3))
      if (r.rank >= node.maxRanks) {
        m.set(r.nodeID, { rank: node.maxRanks, choiceIndex: ci })
      } else {
        m.set(r.nodeID, { rank: r.rank, choiceIndex: ci })
      }
    } else {
      m.set(r.nodeID, { rank: r.rank })
    }
  }
  return m
}

/** Compare two decoded node maps for equality (tests / round-trip). */
export function decodedNodesEqual(
  a: Map<number, DecodedTalentNode>,
  b: Map<number, DecodedTalentNode>
): boolean {
  if (a.size !== b.size) return false
  for (const [id, na] of a) {
    const nb = b.get(id)
    if (!nb) return false
    if (na.rank !== nb.rank) return false
    if ((na.choiceIndex ?? null) !== (nb.choiceIndex ?? null)) return false
  }
  return true
}
