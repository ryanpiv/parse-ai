import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchSpellCooldownsMs } from '../../lib/cooldownSpells/fetchSpellCooldownsServer'

/**
 * POST body: { ids: number[] }
 * Response: { cooldowns: Record<string, number | null>, error?: string }
 * Values are cooldown duration in milliseconds from Blizzard spell API, or null if unknown.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let ids: unknown = req.body?.ids
  if (typeof req.body === 'string') {
    try {
      ids = JSON.parse(req.body).ids
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'body.ids must be an array of spell ids' })
  }

  const numeric = [...new Set(ids.map((x: unknown) => Number(x)).filter(n => Number.isFinite(n) && n > 0))].slice(
    0,
    48
  )

  if (!numeric.length) {
    return res.status(200).json({ cooldowns: {} })
  }

  try {
    const map = await fetchSpellCooldownsMs(numeric)
    const cooldowns: Record<string, number | null> = {}
    for (const [id, ms] of map) cooldowns[String(id)] = ms
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    return res.status(200).json({ cooldowns })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Blizzard spell lookup failed'
    return res.status(200).json({
      cooldowns: {},
      error: msg,
    })
  }
}
