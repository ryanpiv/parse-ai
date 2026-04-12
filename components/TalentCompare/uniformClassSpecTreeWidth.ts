import { computeLayout, type BlizzardNode } from './TalentTree'

/** Shared class+spec width cap used by Compare diff and Raidbots preview layouts. */
export function uniformClassSpecTreeWidth(
  classNodes: BlizzardNode[],
  specNodes: BlizzardNode[],
  nodePx: number,
  stepPx: number,
  maxWidth: number
): number | undefined {
  if (!classNodes.length && !specNodes.length) return undefined
  const classW = classNodes.length ? computeLayout(classNodes, nodePx, stepPx, true).W : 0
  const specW = specNodes.length ? computeLayout(specNodes, nodePx, stepPx, true).W : 0
  return Math.min(Math.max(classW, specW), maxWidth)
}
