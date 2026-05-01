import type { NextApiRequest, NextApiResponse } from 'next'
import { anthropicApiKey } from '../../lib/serverEnv'

export const config = {
  api: {
    responseLimit: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = anthropicApiKey()
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set (Vercel env or .env.local)' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const stream = Boolean((body as { stream?: boolean }).stream)

  try {
    if (stream) {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      if (!upstream.ok) {
        const errText = await upstream.text()
        let errJson: { error?: { message?: string } } | null = null
        try {
          errJson = JSON.parse(errText)
        } catch {
          /* plain text */
        }
        return res.status(upstream.status).json({
          error: errJson?.error?.message || errText.slice(0, 400) || `Anthropic ${upstream.status}`,
        })
      }

      if (!upstream.body) {
        return res.status(502).json({ error: 'Empty upstream body' })
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      const reader = upstream.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } finally {
        res.end()
      }
      return
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
