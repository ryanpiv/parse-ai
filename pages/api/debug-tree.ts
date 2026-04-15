/**
 * Debug endpoint — introspects the WCL GameData type to see what fields exist,
 * then tries querying talent-related fields.
 * GET /api/debug-tree
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { wclToken } from '../../lib/serverEnv'

async function wcl(token: string, query: string, variables = {}) {
  const r = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  return r.json()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = wclToken()
  if (!token) return res.status(500).json({ error: 'WCL_TOKEN not set (Vercel env or .env.local)' })

  // Step 1: introspect GameData to see all available fields
  const introspect = await wcl(token, `{
    __type(name: "GameData") {
      fields {
        name
        description
        args { name type { name kind ofType { name kind } } }
        type { name kind ofType { name kind } }
      }
    }
  }`)

  const fields = introspect?.data?.__type?.fields || []
  const fieldNames = fields.map((f: any) => f.name)

  // Step 2: try to query any talent-related fields we found
  const talentFields = fields.filter((f: any) =>
    f.name.toLowerCase().includes('talent') ||
    f.name.toLowerCase().includes('spec') ||
    f.name.toLowerCase().includes('class')
  )

  // Step 3: also check CombatantInfo event structure from a real report if available
  const combatantFields = await wcl(token, `{
    __type(name: "CombatantInfo") {
      fields { name type { name kind } }
    }
  }`)

  res.json({
    allGameDataFields: fieldNames,
    talentRelatedFields: talentFields.map((f: any) => ({
      name: f.name,
      type: f.type?.name || f.type?.ofType?.name,
      args: f.args?.map((a: any) => a.name),
      description: f.description,
    })),
    combatantInfoFields: combatantFields?.data?.__type?.fields?.map((f: any) => f.name) || 'type not found',
  })
}
