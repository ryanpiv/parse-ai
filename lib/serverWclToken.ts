/**
 * Server-side WarcraftLogs access token via the OAuth client-credentials flow.
 *
 * The operator sets WCL_CLIENT_ID + WCL_CLIENT_SECRET (Vercel env or
 * .env.local); the token is fetched on demand, cached in module memory, and
 * auto-refreshed before expiry. Used ONLY for game-data lookups
 * (/api/talents, /api/debug-tree) — report data always goes through the
 * signed-in user's own token (see lib/wclUserToken.ts and /api/wcl). A static
 * WCL_TOKEN still works as a fallback for old setups.
 */
import { serverEnv, wclToken } from './serverEnv'

const TOKEN_ENDPOINT = 'https://www.warcraftlogs.com/oauth/token'
/** Refresh this long before the reported expiry to avoid using a dying token. */
const EXPIRY_MARGIN_MS = 5 * 60_000

let cached: { token: string; expiresAt: number } | null = null

export function wclClientCredentials(): { id: string; secret: string } | null {
  const id = serverEnv('WCL_CLIENT_ID', 'WCL_CLIENT_ID_LOCAL')
  const secret = serverEnv('WCL_CLIENT_SECRET', 'WCL_CLIENT_SECRET_LOCAL')
  return id && secret ? { id, secret } : null
}

/** True when some WCL credential source is configured (creds or static token). */
export function wclConfigured(): boolean {
  return Boolean(wclClientCredentials() || wclToken())
}

/**
 * Current WCL bearer token: client-credentials (cached/refreshed) when
 * configured, else the static WCL_TOKEN env, else undefined.
 */
export async function getWclToken(): Promise<string | undefined> {
  const creds = wclClientCredentials()
  if (creds) {
    if (cached && Date.now() < cached.expiresAt - EXPIRY_MARGIN_MS) return cached.token
    try {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      })
      const data = (await res.json().catch(() => null)) as
        | { access_token?: string; expires_in?: number }
        | null
      if (data?.access_token) {
        cached = {
          token: data.access_token,
          expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        }
        return cached.token
      }
      console.error('[serverWclToken] client-credentials exchange failed', res.status)
    } catch (e) {
      console.error('[serverWclToken] client-credentials exchange threw', e)
    }
    // Fall through: a stale-but-maybe-alive cached token beats nothing.
    if (cached) return cached.token
  }
  return wclToken()
}

/** Test hook: clear the cached token. */
export function _resetWclTokenCache(): void {
  cached = null
}
