/**
 * Browser-only "Sign in with WarcraftLogs" token — REQUIRED to load report
 * data; there is no shared-token fallback. Stored in localStorage like the
 * Claude BYOK key and sent as `x-wcl-user-token` to /api/wcl (401 without it).
 * Gives the user their own permissions (private logs) and rate-limit budget.
 * Never persisted on the server.
 */
import { useEffect, useState } from 'react'
import { genVerifier, genChallenge } from './pkce'

export const WCL_USER_STORAGE = 'parse-analyzer-wcl-user'
/** Fired on sign-in/sign-out so status rows and auth gates update live. */
export const WCL_USER_CHANGED_EVENT = 'pa:wcl-user-changed'

export interface WclUser {
  token: string
  /** ms epoch; treat as signed-out once past. */
  expiresAt: number
  userName?: string
  /** OAuth refresh token — lets us renew silently instead of re-prompting. */
  refreshToken?: string
}

/** Raw stored entry, including expired ones (needed to attempt a refresh). */
function readStoredWclUser(): WclUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WCL_USER_STORAGE)
    if (!raw) return null
    const u = JSON.parse(raw) as WclUser
    if (!u?.token || typeof u.expiresAt !== 'number') return null
    return u
  } catch {
    return null
  }
}

export function readWclUser(): WclUser | null {
  const u = readStoredWclUser()
  if (!u || Date.now() >= u.expiresAt) return null
  return u
}

export function writeWclUser(user: WclUser | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!user) localStorage.removeItem(WCL_USER_STORAGE)
    else localStorage.setItem(WCL_USER_STORAGE, JSON.stringify(user))
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new Event(WCL_USER_CHANGED_EVENT))
}

/** Headers for `/api/wcl`. The user token is sent only from the browser. */
export function wclClientHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const u = readWclUser()
  if (u) headers['x-wcl-user-token'] = u.token
  return headers
}

/** Renew when this close to expiry (or already past it). */
const REFRESH_MARGIN_MS = 6 * 60 * 60 * 1000
/** Back off between failed refresh attempts so we don't hammer /api/auth. */
const REFRESH_RETRY_COOLDOWN_MS = 60 * 1000

let refreshInFlight: Promise<WclUser | null> | null = null
let lastRefreshFailure = 0

/**
 * Returns a usable WCL user, silently renewing via the stored refresh token
 * when the access token is expired or within REFRESH_MARGIN_MS of expiry.
 * Safe to call from anywhere (concurrent calls share one exchange); resolves
 * null when signed out or the refresh token is rejected after expiry.
 */
export async function ensureFreshWclUser(): Promise<WclUser | null> {
  const stored = readStoredWclUser()
  if (!stored) return null
  const valid = Date.now() < stored.expiresAt
  const needsRefresh = Date.now() >= stored.expiresAt - REFRESH_MARGIN_MS
  if (!needsRefresh) return stored
  if (!stored.refreshToken || Date.now() - lastRefreshFailure < REFRESH_RETRY_COOLDOWN_MS) {
    return valid ? stored : null
  }

  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<WclUser | null> => {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'user-refresh', refreshToken: stored.refreshToken }),
        })
        const data = (await res.json().catch(() => null)) as {
          token?: string
          expiresIn?: number
          refreshToken?: string
          error?: string
        } | null
        if (res.ok && data?.token) {
          const renewed: WclUser = {
            token: data.token,
            expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
            userName: stored.userName,
            // WCL rotates refresh tokens; keep the old one if none came back.
            refreshToken: data.refreshToken || stored.refreshToken,
          }
          writeWclUser(renewed)
          return renewed
        }
        if (res.status === 400) {
          // Refresh token rejected (revoked/rotated elsewhere). Keep a still-valid
          // access token until it runs out; otherwise sign out so the UI prompts.
          lastRefreshFailure = Date.now()
          if (valid) writeWclUser({ ...stored, refreshToken: undefined })
          else writeWclUser(null)
          return valid ? readWclUser() : null
        }
        // Server/network hiccup — leave storage alone and try again later.
        lastRefreshFailure = Date.now()
        return valid ? stored : null
      } catch {
        lastRefreshFailure = Date.now()
        return valid ? stored : null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/** Current signed-in WCL user; updates live on sign-in/out (this tab and others). */
export function useWclUser(): WclUser | null {
  const [user, setUser] = useState<WclUser | null>(null)
  useEffect(() => {
    const update = () => setUser(readWclUser())
    update()
    // Renew a near-expiry/expired token on mount; a successful refresh fires
    // WCL_USER_CHANGED_EVENT, which re-runs update() everywhere.
    void ensureFreshWclUser()
    window.addEventListener(WCL_USER_CHANGED_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(WCL_USER_CHANGED_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return user
}

/**
 * Kick off the OAuth authorization-code + PKCE flow using the app's registered
 * client id (from /api/auth). Redirects to warcraftlogs.com; /auth/callback
 * finishes the exchange and stores the token here.
 */
export async function startWclSignIn(clientId: string): Promise<void> {
  const verifier = genVerifier()
  const state = Math.random().toString(36).slice(2)
  const challenge = await genChallenge(verifier)
  sessionStorage.setItem('wcl_pkce_verifier', verifier)
  sessionStorage.setItem('wcl_pkce_state', state)
  const redirectUri = `${window.location.origin}/auth/callback`
  sessionStorage.setItem('wcl_redirect_uri', redirectUri)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })
  window.location.href = `https://www.warcraftlogs.com/oauth/authorize?${params}`
}
