import { stripColOutliers } from './stripColOutliers'

/** Class / spec / per-hero node groups after stripping leaked columns (shared by diff + preview). */
export function partitionBlizzardTalentNodes<T extends { nodeId: number; type: string; col: number }>(
  all: T[],
  heroTypes: string[]
): {
  heroNodeIds: Set<number>
  classNodesStripped: T[]
  specNodesStripped: T[]
  heroNodesByType: Record<string, T[]>
} {
  const heroNodeIds = new Set(all.filter(n => n.type.startsWith('hero_')).map(n => n.nodeId))
  const classNodesStripped = stripColOutliers(
    all.filter(n => n.type === 'class' && !heroNodeIds.has(n.nodeId))
  )
  // Spec: do not strip — outlier heuristic was for leaked gate nodes in class_talent_nodes only.
  // Frost (and other) specs use wide column ranges; stripping hid real talents.
  const specNodesStripped = all.filter(n => n.type === 'spec' && !heroNodeIds.has(n.nodeId))
  const heroNodesByType: Record<string, T[]> = {}
  for (const ht of heroTypes) {
    heroNodesByType[ht] = all.filter(n => n.type === ht)
  }
  return { heroNodeIds, classNodesStripped, specNodesStripped, heroNodesByType }
}
