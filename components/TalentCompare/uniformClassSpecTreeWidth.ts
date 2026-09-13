import { computeLayout, type BlizzardNode } from './TalentTree'

/**
 * Display widths for the class + spec trees under one shared scale factor, so
 * node icons render the same size in both trees (the widest tree is capped at
 * `maxWidth` and the other shrinks proportionally). Forcing both trees to one
 * equal width instead would blow up the narrower tree's icons.
 */
export function uniformClassSpecTreeWidth(
  classNodes: BlizzardNode[],
  specNodes: BlizzardNode[],
  nodePx: number,
  stepPx: number,
  maxWidth: number
): { classWidth?: number; specWidth?: number } {
  const classW = classNodes.length ? computeLayout(classNodes, nodePx, stepPx, true).W : 0
  const specW = specNodes.length ? computeLayout(specNodes, nodePx, stepPx, true).W : 0
  const widest = Math.max(classW, specW)
  if (!widest) return {}
  const scale = Math.min(1, maxWidth / widest)
  return {
    classWidth: classW ? Math.round(classW * scale) : undefined,
    specWidth: specW ? Math.round(specW * scale) : undefined,
  }
}
