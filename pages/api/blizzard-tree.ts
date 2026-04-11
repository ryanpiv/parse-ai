import type { NextApiRequest, NextApiResponse } from 'next'
import { blizzardGet } from '../../lib/blizzardClient'

const cache: Record<number, { data: any; ts: number }> = {}
const CACHE_TTL = 1000 * 60 * 60 * 24

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const specId = parseInt(String(req.query.specId || '64'))

  // Debug: show raw hero_talent_trees and first node ranks
  if (req.query.debug === 'hero') {
    const specData = await blizzardGet(`/data/wow/playable-specialization/${specId}`, 'static')
    const href: string = specData?.spec_talent_tree?.key?.href || ''
    const m = href.match(/talent-tree\/(\d+)\//)
    if (!m) return res.json({ error: 'no treeId' })
    const treeData = await blizzardGet(`/data/wow/talent-tree/${m[1]}/playable-specialization/${specId}`, 'static')
    const firstNode = (treeData.class_talent_nodes || [])[0]
    return res.json({
      heroTrees: treeData.hero_talent_trees,
      firstNodeRanks: firstNode?.ranks,
      firstNodeKeys: Object.keys(firstNode || {}),
    })
  }

  if (req.query.nocache) delete cache[specId]
  if (cache[specId] && Date.now() - cache[specId].ts < CACHE_TTL) {
    return res.json(cache[specId].data)
  }

  try {
    const specData = await blizzardGet(`/data/wow/playable-specialization/${specId}`, 'static')
    const href: string = specData?.spec_talent_tree?.key?.href || ''
    const m = href.match(/talent-tree\/(\d+)\//)
    if (!m) throw new Error(`No treeId in href: "${href}"`)
    const treeId = parseInt(m[1])

    const treeData = await blizzardGet(
      `/data/wow/talent-tree/${treeId}/playable-specialization/${specId}`,
      'static'
    )

    const nodes: any[] = []
    const edges: { from: number; to: number }[] = []

    function parseNode(n: any, type: string) {
      const ranks = n.ranks || []
      const nodeTypeName: string = n.node_type?.type ?? 'ACTIVE'
      const isChoice = nodeTypeName === 'CHOICE'

      let entries: Array<{ rank: number; spellId: number; name: string; description: string; maxRanks: number }>

      if (isChoice) {
        // CHOICE nodes store options in choice_of_tooltips[], not tooltip
        const choices = ranks[0]?.choice_of_tooltips || []
        entries = choices.map((c: any, idx: number) => ({
          rank: idx + 1,
          spellId: c.spell_tooltip?.spell?.id ?? 0,
          name: c.talent?.name || c.spell_tooltip?.spell?.name || `Choice ${idx + 1}`,
          description: c.spell_tooltip?.description ?? '',
          maxRanks: choices.length,
        }))
      } else {
        // Regular/multi-rank nodes
        const firstName = ranks[0]?.tooltip?.talent?.name || ranks[0]?.tooltip?.spell_tooltip?.spell?.name || null
        entries = ranks.map((r: any, idx: number) => ({
          rank: r.rank ?? idx + 1,
          spellId: r.tooltip?.spell_tooltip?.spell?.id ?? 0,
          name: r.tooltip?.talent?.name || r.tooltip?.spell_tooltip?.spell?.name || firstName || `Node ${n.id}`,
          description: r.tooltip?.spell_tooltip?.description ?? '',
          maxRanks: ranks.length,
        }))
      }

      for (const toId of (n.unlocks || [])) edges.push({ from: n.id, to: toId })

      nodes.push({
        nodeId: n.id,
        row: n.display_row ?? 0,
        col: n.display_col ?? 0,
        rawX: n.raw_position_x ?? null,
        rawY: n.raw_position_y ?? null,
        type,
        nodeType: nodeTypeName,
        entries,
        unlocks: n.unlocks || [],
      })
    }

    for (const n of treeData.class_talent_nodes || []) parseNode(n, 'class')
    for (const n of treeData.spec_talent_nodes  || []) parseNode(n, 'spec')

    // Hero talent trees — nodes are embedded directly in hero_talent_nodes[]
    const heroTrees: any[] = treeData.hero_talent_trees || []
    console.log(`[blizzard-tree] hero_talent_trees count: ${heroTrees.length}`)

    for (const ht of heroTrees) {
      const heroName: string = ht.name || `Hero ${ht.id}`
      const heroType = `hero_${heroName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      const heroNodes: any[] = ht.hero_talent_nodes || []
      console.log(`[blizzard-tree] hero "${heroName}" (${ht.id}): ${heroNodes.length} nodes`)
      for (const n of heroNodes) parseNode(n, heroType)
    }

    const classNodes = nodes.filter(n => n.type === 'class')
    const specNodes  = nodes.filter(n => n.type === 'spec')
    const heroNodes  = nodes.filter(n => n.type.startsWith('hero_'))
    const heroTypes  = [...new Set(heroNodes.map(n => n.type))]

    const bounds = (arr: any[]) => arr.length ? {
      minRow: Math.min(...arr.map(n => n.row)), maxRow: Math.max(...arr.map(n => n.row)),
      minCol: Math.min(...arr.map(n => n.col)), maxCol: Math.max(...arr.map(n => n.col)),
    } : null

    const result = {
      specId, treeId, total: nodes.length, nodes, edges, heroTypes,
      specName: specData.name || null,
      className: specData.playable_class?.name || null,
      bounds: { class: bounds(classNodes), spec: bounds(specNodes), hero: bounds(heroNodes) },
    }

    cache[specId] = { data: result, ts: Date.now() }
    console.log(`[blizzard-tree] class=${classNodes.length} spec=${specNodes.length} hero=${heroNodes.length} heroTypes=${heroTypes} edges=${edges.length}`)
    res.json(result)

  } catch (e: any) {
    console.error('[blizzard-tree]', e.message)
    res.status(500).json({ error: e.message })
  }
}
