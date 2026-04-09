import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Completing authorization...')

  useEffect(() => {
    if (!router.isReady) return

    const code = router.query.code as string | undefined
    const state = router.query.state as string | undefined
    const error = router.query.error as string | undefined

    if (error) {
      setStatus('Authorization denied: ' + error)
      setTimeout(() => router.push('/'), 2000)
      return
    }

    if (!code) {
      setStatus('No authorization code received.')
      setTimeout(() => router.push('/'), 2000)
      return
    }

    const storedState = sessionStorage.getItem('wcl_pkce_state')
    const verifier = sessionStorage.getItem('wcl_pkce_verifier')
    const clientId = sessionStorage.getItem('wcl_client_id')

    if (state !== storedState) {
      setStatus('State mismatch — please try again.')
      setTimeout(() => router.push('/'), 2000)
      return
    }

    setStatus('Exchanging token...')

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exchange', code, verifier, clientId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setStatus('✓ Connected! Redirecting...')
          sessionStorage.removeItem('wcl_pkce_state')
          sessionStorage.removeItem('wcl_pkce_verifier')
          setTimeout(() => router.push('/'), 1000)
        } else {
          setStatus('Error: ' + (data.error || 'Unknown error'))
          setTimeout(() => router.push('/'), 3000)
        }
      })
      .catch((e: Error) => {
        setStatus('Error: ' + e.message)
        setTimeout(() => router.push('/'), 3000)
      })
  }, [router.isReady, router.query])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0c0f', color: '#e8edf2', fontFamily: 'IBM Plex Mono, monospace', fontSize: 14,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: '#e8be40', marginBottom: 16 }}>
          PARSE ANALYZER
        </div>
        <div>{status}</div>
      </div>
    </div>
  )
}
