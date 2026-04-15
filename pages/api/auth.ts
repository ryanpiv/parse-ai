import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { wclToken } from '../../lib/serverEnv'

const WCL_ENDPOINT = 'https://www.warcraftlogs.com/api/v2/client'
const WCL_TOKEN_ENDPOINT = 'https://www.warcraftlogs.com/oauth/token'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const token = wclToken()
    if (!token) {
      return res.status(200).json({ authenticated: false })
    }

    try {
      const r = await fetch(WCL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: '{ rateLimitData { limitPerHour } }' }),
      })
      const text = await r.text()
      try {
        const data = JSON.parse(text)
        if (data.data?.rateLimitData) return res.status(200).json({ authenticated: true })
        return res.status(200).json({ authenticated: false, reason: 'invalid_token' })
      } catch {
        return res.status(200).json({ authenticated: false, reason: 'token_expired' })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      return res.status(200).json({ authenticated: false, reason: message })
    }
  }

  if (req.method === 'POST') {
    const { action, code, verifier, clientId } = req.body as {
      action?: string
      code?: string
      verifier?: string
      clientId?: string
    }

    if (action === 'exchange') {
      try {
        const response = await fetch(WCL_TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId ?? '',
            code: code ?? '',
            redirect_uri: 'http://localhost:3000/auth/callback',
            code_verifier: verifier ?? '',
          }).toString(),
        })

        const data = await response.json()
        if (!data.access_token) {
          return res.status(400).json({ error: data.error_description || 'Token exchange failed' })
        }

        const envPath = path.join(process.cwd(), '.env.local')
        let envContent = ''
        try {
          envContent = fs.readFileSync(envPath, 'utf8')
        } catch {
          envContent = ''
        }

        if (envContent.includes('WCL_TOKEN=')) {
          envContent = envContent.replace(/WCL_TOKEN=.*/m, `WCL_TOKEN=${data.access_token}`)
        } else {
          envContent += `\nWCL_TOKEN=${data.access_token}`
        }
        fs.writeFileSync(envPath, envContent)

        process.env.WCL_TOKEN = data.access_token

        return res.status(200).json({ ok: true })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        return res.status(500).json({ error: message })
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
