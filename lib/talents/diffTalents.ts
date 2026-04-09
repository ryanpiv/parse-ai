export type TalentCategory = 'class' | 'spec' | 'hero'

export type CategorizedTalent = {
  id: number
  defId: number
  nodeId?: number
  name: string
  rank: number
}

export type CategorizedTalents = Record<TalentCategory, CategorizedTalent[]>

export function categorizeTalents(
  talentTree: any[],
  treeLayout: Map<number, any> | null | undefined
): CategorizedTalents {
  const result: CategorizedTalents = { class: [], spec: [], hero: [] }

  talentTree.forEach((t) => {
    const spellId = t.spellId || t.id
    const defId = t.id
    const nodeId = t.nodeID

    const node = treeLayout?.get(defId) || treeLayout?.get(spellId)
    if (node) {
      const category = node.category as TalentCategory
      result[category].push({
        id: spellId,
        defId,
        nodeId,
        name: t.name || node.name || `Talent ${spellId}`,
        rank: t.rank || 1,
      })
      return
    }

    const cat: TalentCategory | null =
      t.type === 0 ? 'class' : t.type === 1 ? 'spec' : t.type === 2 ? 'hero' : null
    if (cat) {
      result[cat].push({
        id: spellId,
        defId,
        nodeId,
        name: t.name || `Talent ${spellId}`,
        rank: t.rank || 1,
      })
    } else {
      result.spec.push({
        id: spellId,
        defId,
        nodeId,
        name: t.name || `Talent ${spellId}`,
        rank: t.rank || 1,
      })
    }
  })

  return result
}
