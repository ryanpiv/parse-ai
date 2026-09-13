import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { writeWclUser } from '../../lib/wclUserToken'

/**
 * "Sign in with WarcraftLogs" landing: exchanges the OAuth code via /api/auth
 * and stores the resulting USER token in this browser's localStorage (the
 * server never keeps it). See lib/wclUserToken.ts.
 */
export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Completing sign-in...')
  const ranRef = useRef(false)

  useEffect(() => {
    if (!router.isReady || ranRef.current) return
    ranRef.current = true

    const code = router.query.code as string | undefined
    const state = router.query.state as string | undefined
    const error = router.query.error as string | undefined

    const fail = (msg: string) => {
      setStatus(msg)
      setTimeout(() => router.push('/'), 3000)
    }

    if (error) return fail('Sign-in denied: ' + error)
    if (!code) return fail('No authorization code received.')

    const storedState = sessionStorage.getItem('wcl_pkce_state')
    const verifier = sessionStorage.getItem('wcl_pkce_verifier')
    const redirectUri =
      sessionStorage.getItem('wcl_redirect_uri') || `${window.location.origin}/auth/callback`

    if (state !== storedState) return fail('State mismatch — please try signing in again.')

    setStatus('Finishing sign-in...')

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'user-exchange', code, verifier, redirectUri }),
    })
      .then(r => r.json())
      .then((data: { token?: string; expiresIn?: number; userName?: string; error?: string }) => {
        if (!data.token) return fail('Sign-in failed: ' + (data.error || 'Unknown error'))
        writeWclUser({
          token: data.token,
          expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
          userName: data.userName,
        })
        sessionStorage.removeItem('wcl_pkce_state')
        sessionStorage.removeItem('wcl_pkce_verifier')
        sessionStorage.removeItem('wcl_redirect_uri')
        setStatus(`✓ Signed in${data.userName ? ` as ${data.userName}` : ''}! Redirecting...`)
        setTimeout(() => router.push('/'), 1000)
      })
      .catch((e: Error) => fail('Sign-in failed: ' + e.message))
  }, [router.isReady, router.query, router])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #0a0c0f)',
        color: 'var(--text, #e8edf2)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            color: 'var(--gold2, #e8be40)',
            marginBottom: 16,
          }}
        >
          PARSE ANALYZER
        </div>
        <div>{status}</div>
      </div>
    </div>
  )
}
