/**
 * /api/talents
 * Batch-resolves talent nodeIDs to spell info using WCL's gameData.ability API.
 * POST body: { nodeIDs: [number] }
 */

const _cache = {}

export default async function handler(req, res) {
  // GET with class/spec returns empty — kept for backwards compat
  if (req.method === 'GET') {
    return res.status(200).json({ nodeMap: {} })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nodeIDs } = req.body
  if (!nodeIDs?.length) return res.status(400).json({ error: 'nodeIDs required' })

  const token = process.env.WCL_TOKEN
  if (!token) return res.status(500).json({ error: 'WCL_TOKEN not set' })

  // Check cache
  const uncached = nodeIDs.filter(id => _cache[id] === undefined)
  
  // Batch query WCL ability API for uncached IDs
  for (let i = 0; i < uncached.length; i += 30) {
    const batch = uncached.slice(i, i + 30)
    try {
      const fields = batch.map((id, j) => `n${j}: ability(id: ${id}) { id name icon }`).join(' ')
      const r = await fetch('https://www.warcraftlogs.com/api/v2/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: `{ gameData { ${fields} } }` })
      })
      const d = await r.json()
      batch.forEach((id, j) => {
        const ab = d?.data?.gameData?.[`n${j}`]
        _cache[id] = ab ? {
          spellId: ab.id,
          name: ab.name,
          icon: ab.icon ? `https://wow.zamimg.com/images/wow/icons/medium/${ab.icon}` : null
        } : null
      })
    } catch {
      batch.forEach(id => { _cache[id] = null })
    }
  }

  // Return map for all requested IDs
  const nodeMap = {}
  nodeIDs.forEach(id => { if (_cache[id]) nodeMap[id] = _cache[id] })

  return res.status(200).json({ nodeMap })
}
