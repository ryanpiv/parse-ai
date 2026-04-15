/**
 * Blizzard Game Data API client
 * Uses client credentials flow — no user login needed.
 * Token is cached in memory for the server process.
 */

import { blizzardClientId, blizzardClientSecret } from './serverEnv'

let cached: { token: string; expiry: number } | null = null

async function getAccessToken(): Promise<string> {
  const id = blizzardClientId() || ''
  const secret = blizzardClientSecret() || ''
  if (!id || !secret) {
    throw new Error('BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET not set (Vercel env or .env.local)')
  }

  const now = Date.now()
  if (cached && now < cached.expiry) return cached.token

  const r = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error(`Blizzard OAuth failed: ${r.status} ${await r.text()}`)
  const data = await r.json()
  const token = data.access_token as string
  cached = { token, expiry: now + ((data.expires_in as number) - 60) * 1000 }
  return token
}

export async function blizzardGet(path: string, namespace: string, region = 'us'): Promise<any> {
  const token = await getAccessToken()
  const url = `https://${region}.api.blizzard.com${path}?namespace=${namespace}-${region}&locale=en_US`
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Blizzard API ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}
