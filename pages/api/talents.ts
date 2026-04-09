import type { NextApiRequest, NextApiResponse } from 'next'
import type { TalentNodeInfo } from '../../types/wcl'

/**
 * Batch-resolves talent nodeIDs to spell info using WCL's gameData.ability API.
 * POST body: { nodeIDs: number[] }
 */

const WCL_ENDPOINT = 'https://www.warcraftlogs.com/api/v2/client'
const BATCH_SIZE = 30

const _cache: Record<number, TalentNodeInfo | null> = {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ nodeMap: {} })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nodeIDs } = req.body as { nodeIDs?: number[] }
  if (!nodeIDs?.length) return res.status(400).json({ error: 'nodeIDs required' })

  const token = process.env.WCL_TOKEN
  if (!token) return res.status(500).json({ error: 'WCL_TOKEN not set' })

  const uncached = nodeIDs.filter(id => _cache[id] === undefined)

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE)
    try {
      const fields = batch.map((id, j) => `n${j}: ability(id: ${id}) { id name icon }`).join(' ')
      const r = await fetch(WCL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: `{ gameData { ${fields} } }` }),
      })
      const d = await r.json()
      const gameData = (d?.data?.gameData ?? {}) as Record<string, { id: number; name: string; icon: string } | undefined>
      batch.forEach((id, j) => {
        const ab = gameData[`n${j}`]
        _cache[id] = ab ? {
          spellId: ab.id,
          name: ab.name,
          icon: ab.icon ? `https://wow.zamimg.com/images/wow/icons/medium/${ab.icon}` : null,
        } : null
      })
    } catch {
      batch.forEach(id => { _cache[id] = null })
    }
  }

  const nodeMap: Record<number, TalentNodeInfo> = {}
  nodeIDs.forEach(id => { if (_cache[id]) nodeMap[id] = _cache[id]! })

  return res.status(200).json({ nodeMap })
}
