/**
 * check-tree.mjs
 * Requires dev server running on port 3000.
 * Run: node scripts/check-tree.mjs [specId]
 * Fetches the blizzard-tree API and reports node stats.
 */
const specId = process.argv[2] || '64'
const url = `http://localhost:3000/api/blizzard-tree?specId=${specId}`

console.log(`Fetching ${url}...\n`)
const r = await fetch(url)
if (!r.ok) { console.error('HTTP', r.status); process.exit(1) }
const d = await r.json()
if (d.error) { console.error('API error:', d.error); process.exit(1) }

console.log(`specId=${d.specId}  treeId=${d.treeId}  specName=${d.specName}  className=${d.className}`)
console.log(`Total nodes: ${d.total}  |  Edges: ${d.edges?.length}`)

const byType = {}
for (const n of d.nodes) {
  if (!byType[n.type]) byType[n.type] = { total: 0, noSpell: 0, nodes: [] }
  byType[n.type].total++
  const hasSpell = n.entries.some(e => e.spellId > 0)
  if (!hasSpell) {
    byType[n.type].noSpell++
    byType[n.type].nodes.push({ nodeId: n.nodeId, row: n.row, col: n.col, nodeType: n.nodeType, firstName: n.entries[0]?.name })
  }
}

for (const [type, stats] of Object.entries(byType)) {
  console.log(`\n[${type}] ${stats.total} nodes, ${stats.noSpell} with no spellId`)
  if (stats.noSpell > 0) {
    for (const n of stats.nodes) {
      console.log(`  nodeId=${n.nodeId} row=${n.row} col=${n.col} type=${n.nodeType} name="${n.firstName}"`)
    }
  }
}

console.log('\nheroTypes:', d.heroTypes)
console.log('\nbounds:', JSON.stringify(d.bounds, null, 2))
