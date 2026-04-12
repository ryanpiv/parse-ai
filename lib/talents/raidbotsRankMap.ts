export function sumRanks(nodes: Array<{ rank?: number }>): number {
  return nodes.reduce((s, n) => s + (n.rank ?? 0), 0)
}

/** Single-player Raidbots-style: ranks from a map, state p1 vs neither for TalentTree. */
export function applyRankMapAsRaidbotsP1<T extends { nodeId: number }>(
  nodes: T[],
  r: Map<number, number>
): Array<T & { rank: number; state: 'p1' | 'neither' }> {
  return nodes.map(n => {
    const rank = r.has(n.nodeId) ? r.get(n.nodeId)! : 0
    return {
      ...n,
      rank,
      state: rank > 0 ? ('p1' as const) : ('neither' as const),
    }
  })
}
