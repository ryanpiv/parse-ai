/** QA / demo: fill trees to a point budget in row-major order with parent gates. */

export function maxRankForNode(n: {
  nodeType: string
  entries: Array<{ maxRanks: number }>
}): number {
  if (n.nodeType === 'CHOICE') return 1
  return n.entries[0]?.maxRanks ?? 1
}

export function allocateTalentRanks<
  T extends {
    nodeId: number
    row: number
    col: number
    nodeType: string
    entries: Array<{ maxRanks: number }>
  },
>(nodes: T[], edges: { from: number; to: number }[], budget: number): Map<number, number> {
  const ids = new Set(nodes.map(n => n.nodeId))
  const parents = new Map<number, number[]>()
  for (const n of nodes) parents.set(n.nodeId, [])
  for (const e of edges) {
    if (ids.has(e.from) && ids.has(e.to)) parents.get(e.to)!.push(e.from)
  }

  const sorted = [...nodes].sort((a, b) => a.row - b.row || a.col - b.col || a.nodeId - b.nodeId)
  const rank = new Map<number, number>()
  let spent = 0

  let progress = true
  while (progress && spent < budget) {
    progress = false
    for (const n of sorted) {
      if (spent >= budget) break
      const ps = parents.get(n.nodeId) || []
      if (ps.length && ps.some(p => (rank.get(p) ?? 0) < 1)) continue

      const cur = rank.get(n.nodeId) ?? 0
      const cap = maxRankForNode(n)
      if (cur >= cap) continue

      const add = Math.min(cap - cur, budget - spent)
      if (add <= 0) continue
      rank.set(n.nodeId, cur + add)
      spent += add
      progress = true
    }
  }
  return rank
}
