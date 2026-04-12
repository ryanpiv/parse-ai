import { describe, it, expect } from '@jest/globals'
import {
  parseTalentStringHeader,
  decodeTalentString,
  encodeTalentString,
  decodedNodesEqual,
  wclRowsToDecodedNodes,
  type TreeNodeInfo,
} from '../../../lib/talents/decodeTalentString'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function uint8ToBase64(bytes: Uint8Array): string {
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

/** Build a talent string from a bit-level description. */
function buildTalentString(version: number, specId: number, bodyBits: number[]): string {
  const bits: number[] = []
  function push(val: number, n: number) {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  push(version, 8)
  push(specId, 16)
  push(0, 64) // treeHash high
  push(0, 64) // treeHash low
  bits.push(...bodyBits)
  while (bits.length % 8 !== 0) bits.push(0)
  const bytes = new Uint8Array(bits.length / 8)
  for (let i = 0; i < bytes.length; i++) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j]
    bytes[i] = b
  }
  return uint8ToBase64(bytes)
}

const TEST_TREE_NODES: TreeNodeInfo[] = [
  { nodeId: 100, nodeType: 'ACTIVE', maxRanks: 2 },
  { nodeId: 200, nodeType: 'ACTIVE', maxRanks: 1 },
  { nodeId: 300, nodeType: 'CHOICE', maxRanks: 2 },
]

// Body bits:
//   Node 100: selected(1) purchased(1) notPartial(0) notChoice(0)
//   Node 200: notSelected(0)
//   Node 300: selected(1) purchased(1) partial(1) rank=1(000001) choice(1) idx=1(01)
const TEST_BODY = [1,1,0,0, 0, 1,1,1, 0,0,0,0,0,1, 1, 0,1]
const TEST_STRING = buildTalentString(1, 64, TEST_BODY)

describe('parseTalentStringHeader', () => {
  it('extracts version and specId from the header', () => {
    const header = parseTalentStringHeader(TEST_STRING)
    expect(header.version).toBe(1)
    expect(header.specId).toBe(64)
  })

  it('throws on empty string', () => {
    expect(() => parseTalentStringHeader('')).toThrow()
  })

  it('throws on truncated string (too short for header)', () => {
    expect(() => parseTalentStringHeader('AQ==')).toThrow()
  })
})

describe('decodeTalentString', () => {
  it('decodes all nodes correctly against the tree', () => {
    const result = decodeTalentString(TEST_STRING, TEST_TREE_NODES)

    expect(result.specId).toBe(64)
    expect(result.version).toBe(1)
    expect(result.nodes.size).toBe(2)

    const node100 = result.nodes.get(100)
    expect(node100).toBeDefined()
    expect(node100!.rank).toBe(2)
    expect(node100!.choiceIndex).toBeUndefined()

    expect(result.nodes.has(200)).toBe(false)

    const node300 = result.nodes.get(300)
    expect(node300).toBeDefined()
    expect(node300!.rank).toBe(1)
    expect(node300!.choiceIndex).toBe(1)
  })

  it('handles granted (not purchased) nodes as rank 1', () => {
    const str = buildTalentString(1, 64, [1, 0]) // selected, not purchased
    const nodes: TreeNodeInfo[] = [
      { nodeId: 50, nodeType: 'ACTIVE', maxRanks: 3 },
    ]
    const result = decodeTalentString(str, nodes)
    expect(result.nodes.get(50)).toEqual({ rank: 1 })
  })

  it('returns empty map when no nodes are selected', () => {
    const str = buildTalentString(1, 64, [0, 0])
    const nodes: TreeNodeInfo[] = [
      { nodeId: 10, nodeType: 'ACTIVE', maxRanks: 1 },
      { nodeId: 20, nodeType: 'ACTIVE', maxRanks: 1 },
    ]
    const result = decodeTalentString(str, nodes)
    expect(result.nodes.size).toBe(0)
  })

  it('handles full-rank non-choice node', () => {
    // selected, purchased, not partial (= max rank), not choice
    const str = buildTalentString(1, 64, [1, 1, 0, 0])
    const nodes: TreeNodeInfo[] = [
      { nodeId: 1, nodeType: 'ACTIVE', maxRanks: 3 },
    ]
    const result = decodeTalentString(str, nodes)
    expect(result.nodes.get(1)).toEqual({ rank: 3 })
  })

  it('round-trips encode → decode for the synthetic string', () => {
    const dec = decodeTalentString(TEST_STRING, TEST_TREE_NODES)
    const enc = encodeTalentString({
      specId: dec.specId,
      version: dec.version,
      treeNodes: TEST_TREE_NODES,
      nodes: dec.nodes,
    })
    const dec2 = decodeTalentString(enc, TEST_TREE_NODES)
    expect(dec2.specId).toBe(dec.specId)
    expect(dec2.version).toBe(dec.version)
    expect(decodedNodesEqual(dec.nodes, dec2.nodes)).toBe(true)
  })

  it('encodes from WCL-shaped rows via wclRowsToDecodedNodes', () => {
    const treeNodes: TreeNodeInfo[] = [{ nodeId: 10, nodeType: 'ACTIVE', maxRanks: 3 }]
    const rows = [{ nodeID: 10, rank: 3 }]
    const m = wclRowsToDecodedNodes(rows, treeNodes)
    const s = encodeTalentString({ specId: 62, treeNodes, nodes: m })
    const d = decodeTalentString(s, treeNodes)
    expect(d.nodes.get(10)).toEqual({ rank: 3 })
  })

  it('versionFromExport copies only the header version byte, not specId', () => {
    const ref = buildTalentString(99, 777, [0]) // version 99, bogus specId 777, one unselected node bit
    const treeNodes: TreeNodeInfo[] = [{ nodeId: 10, nodeType: 'ACTIVE', maxRanks: 1 }]
    const nodes = new Map([[10, { rank: 1 }]])
    const enc = encodeTalentString({
      specId: 62,
      treeNodes,
      nodes,
      versionFromExport: ref,
    })
    const d = decodeTalentString(enc, treeNodes)
    expect(d.version).toBe(99)
    expect(d.specId).toBe(62)
  })

  it('round-trips granted and full-rank nodes', () => {
    const str = buildTalentString(1, 64, [1, 0, 1, 1, 0, 0]) // granted then full max on maxRanks=3
    const nodes: TreeNodeInfo[] = [
      { nodeId: 1, nodeType: 'ACTIVE', maxRanks: 1 },
      { nodeId: 2, nodeType: 'ACTIVE', maxRanks: 3 },
    ]
    const dec = decodeTalentString(str, nodes)
    const enc = encodeTalentString({ specId: dec.specId, version: dec.version, treeNodes: nodes, nodes: dec.nodes })
    const dec2 = decodeTalentString(enc, nodes)
    expect(decodedNodesEqual(dec.nodes, dec2.nodes)).toBe(true)
  })

  it('throws when string is too short for the node data', () => {
    // Header only (19 bytes = 152 bits), no body, but 10 nodes need 10+ bits
    const bytes = new Uint8Array(19)
    bytes[0] = 1
    bytes[2] = 64
    const str = uint8ToBase64(bytes)

    const manyNodes: TreeNodeInfo[] = Array.from({ length: 10 }, (_, i) => ({
      nodeId: i, nodeType: 'ACTIVE', maxRanks: 1,
    }))

    expect(() => decodeTalentString(str, manyNodes)).toThrow('Unexpected end')
  })
})
