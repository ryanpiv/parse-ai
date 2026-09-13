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
}

export function readWclUser(): WclUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WCL_USER_STORAGE)
    if (!raw) return null
    const u = JSON.parse(raw) as WclUser
    if (!u?.token || typeof u.expiresAt !== 'number') return null
    if (Date.now() >= u.expiresAt) return null
    return u
  } catch {
    return null
  }
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

/** Current signed-in WCL user; updates live on sign-in/out (this tab and others). */
export function useWclUser(): WclUser | null {
  const [user, setUser] = useState<WclUser | null>(null)
  useEffect(() => {
    const update = () => setUser(readWclUser())
    update()
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
