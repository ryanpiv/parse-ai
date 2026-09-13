import { stripColOutliers } from './stripColOutliers'

/**
 * Subtree-selection meta-nodes (pick Sunfury vs Spellslinger etc.) surface as CHOICE
 * nodes with no choice tooltips. They must stay in the raw payload — export string
 * decode/encode walks every node in nodeId order — but they are not renderable
 * talents, so they are dropped here before bucketing.
 */
function isRenderableTalentNode(n: { nodeType?: string; entries?: unknown[] }): boolean {
  return !(n.nodeType === 'CHOICE' && (!n.entries || n.entries.length === 0))
}

/** Class / spec / per-hero node groups after stripping leaked columns (shared by diff + preview). */
export function partitionBlizzardTalentNodes<
  T extends { nodeId: number; type: string; col: number; nodeType?: string; entries?: unknown[] },
>(
  all: T[],
  heroTypes: string[]
): {
  heroNodeIds: Set<number>
  classNodesStripped: T[]
  specNodesStripped: T[]
  heroNodesByType: Record<string, T[]>
} {
  const renderable = all.filter(isRenderableTalentNode)
  const heroNodeIds = new Set(renderable.filter(n => n.type.startsWith('hero_')).map(n => n.nodeId))
  const classNodesStripped = stripColOutliers(
    renderable.filter(n => n.type === 'class' && !heroNodeIds.has(n.nodeId))
  )
  // Spec: do not strip — outlier heuristic was for leaked gate nodes in class_talent_nodes only.
  // Frost (and other) specs use wide column ranges; stripping hid real talents.
  const specNodesStripped = renderable.filter(n => n.type === 'spec' && !heroNodeIds.has(n.nodeId))
  const heroNodesByType: Record<string, T[]> = {}
  for (const ht of heroTypes) {
    heroNodesByType[ht] = renderable.filter(n => n.type === ht)
  }
  return { heroNodeIds, classNodesStripped, specNodesStripped, heroNodesByType }
}
