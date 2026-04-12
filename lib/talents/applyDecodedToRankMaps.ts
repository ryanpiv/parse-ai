import type { DecodedTalentNode } from './decodeTalentString'

/** Merge decoded export nodes into class/spec/hero rank maps (preview / compare encoding). */
export function applyDecodedNodesToRankMaps(
  decoded: Map<number, DecodedTalentNode>,
  all: Array<{ nodeId: number; type: string }>,
  heroNodeIds: Set<number>,
  classR: Map<number, number>,
  specR: Map<number, number>,
  heroRs: Record<string, Map<number, number>>
): void {
  for (const [nodeId, node] of decoded) {
    const blizz = all.find(n => n.nodeId === nodeId)
    if (!blizz || node.rank <= 0) continue
    if (blizz.type === 'class' && !heroNodeIds.has(nodeId)) classR.set(nodeId, node.rank)
    else if (blizz.type === 'spec' && !heroNodeIds.has(nodeId)) specR.set(nodeId, node.rank)
    else if (blizz.type.startsWith('hero_')) {
      if (!heroRs[blizz.type]) heroRs[blizz.type] = new Map()
      heroRs[blizz.type]!.set(nodeId, node.rank)
    }
  }
}
