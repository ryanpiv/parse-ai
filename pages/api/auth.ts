import type { NextApiRequest, NextApiResponse } from 'next'
import { wclClientCredentials, wclPublicClientId } from '../../lib/serverWclToken'

const WCL_USER_ENDPOINT = 'https://www.warcraftlogs.com/api/v2/user'
const WCL_TOKEN_ENDPOINT = 'https://www.warcraftlogs.com/oauth/token'

/**
 * Every user signs in with their own WCL account — there is no shared token for
 * report data.
 *
 * GET — `{ clientId }`: the app's public WCL client id, which the browser needs
 * to build the "Sign in with WarcraftLogs" URL (null = operator hasn't set
 * WCL_CLIENT_ID, so sign-in is unavailable).
 *
 * POST `{ action: 'user-exchange', code, verifier, redirectUri }` — finish the
 * per-user OAuth flow: exchange the authorization code and hand the resulting
 * token BACK to the browser (`{ token, expiresIn, refreshToken, userName }`).
 * It is stored in the user's localStorage only — never on the server. WCL
 * "public" (PKCE) clients have no secret, so the exchange sends one only when
 * configured.
 *
 * POST `{ action: 'user-refresh', refreshToken }` — renew an expiring user
 * token via the OAuth refresh_token grant. Returns the same shape as the
 * exchange (WCL rotates refresh tokens, so the response carries a new one).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        return res.status(200).json({ clientId: wclPublicClientId() ?? null })
    }

    if (req.method === 'POST' && req.body?.action === 'user-exchange') {
        const { code, verifier, redirectUri } = req.body as {
            code?: string
            verifier?: string
            redirectUri?: string
        }
        const clientId = wclPublicClientId()
        if (!clientId) {
            return res.status(400).json({
                error: 'Server has no WCL_CLIENT_ID — sign-in is unavailable.',
            })
        }
        if (!code || !redirectUri) {
            return res.status(400).json({ error: 'code and redirectUri are required.' })
        }

        try {
            const secret = wclClientCredentials()?.secret
            const response = await fetch(WCL_TOKEN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: clientId,
                    ...(secret ? { client_secret: secret } : {}),
                    redirect_uri: redirectUri,
                    code,
                    ...(verifier ? { code_verifier: verifier } : {}),
                }).toString(),
            })
            const data = (await response.json().catch(() => null)) as {
                access_token?: string
                expires_in?: number
                refresh_token?: string
                error_description?: string
            } | null
            if (!data?.access_token) {
                return res.status(400).json({ error: data?.error_description || 'Token exchange failed' })
            }

            // Who signed in? Only the /user endpoint exposes currentUser.
            let userName: string | undefined
            try {
                const ur = await fetch(WCL_USER_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${data.access_token}`,
                    },
                    body: JSON.stringify({ query: '{ userData { currentUser { name } } }' }),
                })
                const uj = (await ur.json().catch(() => null)) as any
                userName = uj?.data?.userData?.currentUser?.name || undefined
            } catch {
                /* name is cosmetic */
            }

            return res.status(200).json({
                token: data.access_token,
                expiresIn: data.expires_in ?? 3600,
                refreshToken: data.refresh_token,
                userName,
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error'
            return res.status(500).json({ error: message })
        }
    }

    if (req.method === 'POST' && req.body?.action === 'user-refresh') {
        const { refreshToken } = req.body as { refreshToken?: string }
        const clientId = wclPublicClientId()
        if (!clientId) {
            return res.status(400).json({ error: 'Server has no WCL_CLIENT_ID — refresh is unavailable.' })
        }
        if (!refreshToken) {
            return res.status(400).json({ error: 'refreshToken is required.' })
        }

        try {
            const secret = wclClientCredentials()?.secret
            const response = await fetch(WCL_TOKEN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    ...(secret ? { client_secret: secret } : {}),
                    refresh_token: refreshToken,
                }).toString(),
            })
            const data = (await response.json().catch(() => null)) as {
                access_token?: string
                expires_in?: number
                refresh_token?: string
                error_description?: string
            } | null
            if (!data?.access_token) {
                // invalid_grant etc. — the browser drops its refresh token and falls back to re-sign-in.
                return res.status(400).json({ error: data?.error_description || 'Token refresh failed' })
            }
            return res.status(200).json({
                token: data.access_token,
                expiresIn: data.expires_in ?? 3600,
                refreshToken: data.refresh_token,
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error'
            return res.status(500).json({ error: message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
