/**
 * Blizzard Game Data API client
 * Uses client credentials flow — no user login needed.
 * Token is cached in memory for its lifetime (usually 24h).
 */

import { blizzardClientId, blizzardClientSecret } from './serverEnv'

let _token: string | null = null
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token

  const id = blizzardClientId()
  const secret = blizzardClientSecret()
  if (!id || !secret) throw new Error('BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET not set (Vercel env or .env.local)')

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
  _token = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return _token!
}

export async function blizzardGet(path: string, namespace: string, region = 'us'): Promise<any> {
  const token = await getToken()
  const url = `https://${region}.api.blizzard.com${path}?namespace=${namespace}-${region}&locale=en_US`
  const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`Blizzard API ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}
