import type { NextApiRequest, NextApiResponse } from 'next'

const WCL_ENDPOINT = 'https://www.warcraftlogs.com/api/v2/client'
const RATE_LIMIT_QUERY = '{ rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn } }'

function getToken(): string | undefined {
  const token = process.env.WCL_TOKEN
  if (!token || token === 'paste_your_wcl_token_here') return undefined
  return token
}

async function wclFetch(token: string, body: object): Promise<{ status: number; text: string }> {
  const response = await fetch(WCL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, text }
}

function tryParseJSON(text: string): { ok: true; data: unknown } | { ok: false } {
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

function safeJson(res: NextApiResponse, status: number, payload: unknown) {
  if (res.writableEnded) return
  try {
    return res.status(status).json(payload)
  } catch (e) {
    console.error('[api/wcl] res.json failed', e)
    if (!res.writableEnded) {
      return res.status(500).json({ error: 'Failed to serialize API response (WCL payload may be invalid).' })
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const token = getToken()
      if (!token) return safeJson(res, 500, { error: 'WCL_TOKEN not set in .env.local' })

      try {
        const { status, text } = await wclFetch(token, { query: RATE_LIMIT_QUERY })
        if (status !== 200) {
          return safeJson(res, status, { error: `WCL returned ${status}`, body: text.slice(0, 300) })
        }

        const parsed = tryParseJSON(text)
        if (!parsed.ok) {
          return safeJson(res, 500, {
            error: 'WCL returned non-JSON — token likely expired',
            body: text.slice(0, 300),
          })
        }

        const data = parsed.data as Record<string, unknown>
        return safeJson(res, 200, { ok: true, rateLimit: (data?.data as Record<string, unknown>)?.rateLimitData })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return safeJson(res, 500, { error: message })
      }
    }

    if (req.method !== 'POST') {
      return safeJson(res, 405, { error: 'Method not allowed' })
    }

    const token = getToken()
    if (!token) return safeJson(res, 500, { error: 'WCL_TOKEN not set in .env.local' })

    // Special action: extract talent strings from a WCL compare URL
    if (req.body?.action === 'compare-talents') {
      return await handleCompareTalents(req, res, token)
    }

    if (req.body == null || typeof req.body !== 'object' || typeof (req.body as { query?: unknown }).query !== 'string') {
      return safeJson(res, 400, {
        error: 'Expected JSON body { query: string, variables?: object }. If you see this in the app, the WCL client is misconfigured.',
      })
    }

    try {
      const { status, text } = await wclFetch(token, req.body as object)
      if (status !== 200) {
        return safeJson(res, status, { error: `WCL returned ${status}`, body: text.slice(0, 300) })
      }

      const parsed = tryParseJSON(text)
      if (!parsed.ok) {
        return safeJson(res, 500, {
          error:
            'WCL returned non-JSON — token likely expired. Get a new token from parse-analyzer-ai.html and update .env.local',
          body: text.slice(0, 300),
        })
      }

      return safeJson(res, 200, parsed.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return safeJson(res, 500, { error: message })
    }
  } catch (err) {
    console.error('[api/wcl] unhandled', err)
    if (!res.writableEnded) {
      return safeJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
        hint: 'Check the terminal running `npm run dev` for [api/wcl] logs.',
      })
    }
  }
}

/** Unwrap GraphQL `data` from WCL HTTP JSON (`{ data, errors? }`). */
function gqlData(httpBody: any): any {
  if (!httpBody || typeof httpBody !== 'object') return null
  if ('data' in httpBody && httpBody.data !== undefined) return httpBody.data
  return httpBody
}

async function gqlQuery(token: string, query: string, variables: Record<string, unknown>) {
  const { status, text } = await wclFetch(token, { query, variables })
  if (status !== 200) throw new Error(`WCL returned ${status}`)
  const parsed = tryParseJSON(text)
  if (!parsed.ok) throw new Error('WCL returned non-JSON — token may be expired')
  const httpBody = parsed.data as any
  if (Array.isArray(httpBody?.errors) && httpBody.errors.length) {
    throw new Error(httpBody.errors.map((e: any) => e.message).join('; '))
  }
  return httpBody
}

function isPlayerActor(a: any): boolean {
  const t = String(a?.type || '').toLowerCase()
  return t === 'player'
}

function findActor(actors: any[], srcRaw: string) {
  const src = srcRaw.trim()
  if (!src) return undefined
  if (!isNaN(Number(src))) {
    const id = parseInt(src, 10)
    return actors.find((a: any) => a.id === id && isPlayerActor(a))
  }
  const lower = src.toLowerCase()
  return actors.find((a: any) => a.name?.toLowerCase() === lower && isPlayerActor(a))
}

function findFight(fights: any[], fid: number) {
  return fights.find((f: any) => Number(f.id) === fid)
}

/** Same CombatantInfo query as lib/talents/fetchTalents.ts */
const COMBATANT_INFO_QUERY = `
  query($code: String!, $fightId: Int!, $start: Float!, $end: Float!) {
    reportData { report(code: $code) {
      events(dataType: CombatantInfo, fightIDs: [$fightId], startTime: $start, endTime: $end, limit: 100) { data }
    }}
  }
`

async function fetchCombatantEvents(
  token: string,
  reportCode: string,
  fightId: number,
  start: number,
  end: number
): Promise<any[]> {
  const root = await gqlQuery(token, COMBATANT_INFO_QUERY, {
    code: reportCode,
    fightId,
    start,
    end,
  })
  const report = gqlData(root)?.reportData?.report
  return report?.events?.data || []
}

async function resolvePlayerEvent(
  token: string,
  reportCode: string,
  fightId: number,
  fightStart: number,
  fightEnd: number,
  playerName: string,
  playerId: number | undefined,
  events: any[]
): Promise<any | null> {
  let playerEvent = playerId != null
    ? events.find((e: any) => Number(e.sourceID) === Number(playerId))
    : null

  if (!playerEvent) {
    const pdRoot = await gqlQuery(
      token,
      `query($code: String!, $fightId: Int!) {
        reportData { report(code: $code) { playerDetails(fightIDs: [$fightId]) } }
      }`,
      { code: reportCode, fightId },
    )
    const details = gqlData(pdRoot)?.reportData?.report?.playerDetails?.data
    const allPlayers = [...(details?.dps || []), ...(details?.healers || []), ...(details?.tanks || [])]
    const pd = allPlayers.find((p: any) => p.name?.toLowerCase() === playerName?.toLowerCase())
    if (pd) playerEvent = events.find((e: any) => Number(e.sourceID) === Number(pd.id))
  }

  if (!playerEvent && events.length === 1) playerEvent = events[0]
  return playerEvent || null
}

function normalizeTalentTreeRows(raw: any): any[] {
  const arr = Array.isArray(raw) ? raw : []
  return arr
    .map((t: any) => ({
      id: t.spellId || t.id || 0,
      nodeID: t.nodeID ?? t.nodeId,
      rank: t.rank ?? 0,
    }))
    .filter((t: any) => t.nodeID != null && Number(t.nodeID) > 0)
}

async function handleCompareTalents(req: NextApiRequest, res: NextApiResponse, token: string) {
  try {
    const url: string = req.body.url || ''
    const pm = url.match(/\/reports\/compare\/([^/]+)\/([^/?]+)/)
    if (!pm) return res.status(400).json({ error: 'Cannot find report codes in URL. Expected a WCL compare URL.' })
    const r1 = pm[1], r2 = pm[2]

    const u = new URL(url.startsWith('http') ? url : 'https://www.warcraftlogs.com' + url)
    const fights = (u.searchParams.get('fight') || '').split(',').map(s => s.trim()).filter(Boolean)
    const f1id = parseInt(fights[0] || '0', 10)
    const f2id = parseInt(fights[1] || fights[0] || '0', 10)
    const srcs = (u.searchParams.get('source') || '').split(',').map(s => s.trim())
    const src1 = srcs[0] || ''
    const src2 = srcs[1] || srcs[0] || ''

    if (!f1id || !f2id) return res.status(400).json({ error: 'Could not parse fight IDs from URL.' })

    const metaQuery = `query($code: String!){
      reportData{report(code:$code){fights{id startTime endTime} masterData{actors{id name type}}}}
    }`

    const [m1, m2] = await Promise.all([
      gqlQuery(token, metaQuery, { code: r1 }),
      gqlQuery(token, metaQuery, { code: r2 }),
    ])

    const rep1 = gqlData(m1)?.reportData?.report
    const rep2 = gqlData(m2)?.reportData?.report
    const fight1 = findFight(rep1?.fights || [], f1id)
    const fight2 = findFight(rep2?.fights || [], f2id)
    if (!fight1) return res.status(400).json({ error: `Fight ${f1id} not found in report ${r1}.` })
    if (!fight2) return res.status(400).json({ error: `Fight ${f2id} not found in report ${r2}.` })

    const a1 = rep1?.masterData?.actors || []
    const a2 = rep2?.masterData?.actors || []
    const actor1 = findActor(a1, src1)
    const actor2 = findActor(a2, src2)
    const name1 = actor1?.name || src1
    const name2 = actor2?.name || src2
    /** Numeric source= in URL is the combatant sourceID even if masterData actor match fails */
    const id1 = actor1?.id ?? (/^\d+$/.test(src1) ? parseInt(src1, 10) : undefined)
    const id2 = actor2?.id ?? (/^\d+$/.test(src2) ? parseInt(src2, 10) : undefined)

    const [events1, events2] = await Promise.all([
      fetchCombatantEvents(token, r1, f1id, fight1.startTime, fight1.endTime),
      fetchCombatantEvents(token, r2, f2id, fight2.startTime, fight2.endTime),
    ])

    const ev1 = await resolvePlayerEvent(
      token, r1, f1id, fight1.startTime, fight1.endTime, name1, id1, events1
    )
    const ev2 = await resolvePlayerEvent(
      token, r2, f2id, fight2.startTime, fight2.endTime, name2, id2, events2
    )

    const b1 = ev1?.talentSpec || null
    const b2 = ev2?.talentSpec || null

    const tree1Raw = ev1?.talentTree?.length ? ev1.talentTree : ev1?.talents
    const tree2Raw = ev2?.talentTree?.length ? ev2.talentTree : ev2?.talents
    const tree1 = normalizeTalentTreeRows(tree1Raw)
    const tree2 = normalizeTalentTreeRows(tree2Raw)

    const specId = ev1?.specID ?? ev2?.specID ?? null

    if (!b1 && !b2 && !tree1.length && !tree2.length) {
      return res.status(200).json({
        error: 'No CombatantInfo talent data for either player. If the log is very old, WCL may not have stored talents. Try a recent report.',
        debug: {
          events1: events1.length,
          events2: events2.length,
          matched1: !!ev1,
          matched2: !!ev2,
        },
      })
    }

    return res.status(200).json({
      b1,
      b2,
      tree1,
      tree2,
      n1: name1,
      n2: name2,
      specId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
