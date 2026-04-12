import type { TreeNodeInfo } from './decodeTalentString'

/** Blizzard `/api/blizzard-tree` node list → decoder node order (sorted by nodeId). */
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
