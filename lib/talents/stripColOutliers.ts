/**
 * Strip nodes whose display_col is a statistical outlier — e.g. a single node
 * at col 11 when every other node sits in cols 0-6. Blizzard sometimes leaks
 * cross-tree gate/link nodes into class_talent_nodes.
 */
export function stripColOutliers<T extends { col: number }>(nodes: T[]): T[] {
  if (nodes.length < 5) return nodes
  const uniq = [...new Set(nodes.map(n => n.col))].sort((a, b) => a - b)
  if (uniq.length < 3) return nodes

  const secondLast = uniq[uniq.length - 2]
  const last = uniq[uniq.length - 1]
  const typicalStep = (secondLast - uniq[0]) / (uniq.length - 2)
  if (last - secondLast > typicalStep * 3) {
    return nodes.filter(n => n.col <= secondLast)
  }

  const first = uniq[0]
  const second = uniq[1]
  const typicalStepHi = (uniq[uniq.length - 1] - second) / (uniq.length - 2)
  if (second - first > typicalStepHi * 3) {
    return nodes.filter(n => n.col >= second)
  }

  return nodes
}
