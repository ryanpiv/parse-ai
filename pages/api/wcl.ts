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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const token = getToken()
    if (!token) return res.status(500).json({ error: 'WCL_TOKEN not set in .env.local' })

    try {
      const { status, text } = await wclFetch(token, { query: RATE_LIMIT_QUERY })
      if (status !== 200) return res.status(status).json({ error: `WCL returned ${status}`, body: text.slice(0, 300) })

      const parsed = tryParseJSON(text)
      if (!parsed.ok) return res.status(500).json({ error: 'WCL returned non-JSON — token likely expired', body: text.slice(0, 300) })

      const data = parsed.data as Record<string, unknown>
      return res.status(200).json({ ok: true, rateLimit: (data?.data as Record<string, unknown>)?.rateLimitData })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = getToken()
  if (!token) return res.status(500).json({ error: 'WCL_TOKEN not set in .env.local' })

  try {
    const { status, text } = await wclFetch(token, req.body)
    if (status !== 200) return res.status(status).json({ error: `WCL returned ${status}`, body: text.slice(0, 300) })

    const parsed = tryParseJSON(text)
    if (!parsed.ok) {
      return res.status(500).json({
        error: 'WCL returned non-JSON — token likely expired. Get a new token from parse-analyzer-ai.html and update .env.local',
        body: text.slice(0, 300),
      })
    }

    return res.status(200).json(parsed.data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
