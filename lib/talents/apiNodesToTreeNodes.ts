import type { TreeNodeInfo } from './decodeTalentString'

/**
 * Blizzard `/api/blizzard-tree` node list → `TreeNodeInfo[]` for decode/encode.
 * Sorted by **nodeId** (canonical import/export order); decode/encode also sort internally.
 */
export function apiNodesToTreeNodes(
  nodes: Array<{ nodeId: number; nodeType: string; entries: Array<{ maxRanks: number }> }>
): TreeNodeInfo[] {
  return [...nodes]
    .sort((a, b) => a.nodeId - b.nodeId)
    .map(n => ({
      nodeId: n.nodeId,
      nodeType: n.nodeType,
      maxRanks: n.entries[0]?.maxRanks ?? 1,
    }))
}
