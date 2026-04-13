import { useEffect } from 'react'
import { useRouter } from 'next/router'

/** @deprecated Use `/` — Analyze lives on the home page with Solo | Compare subtabs. */
export default function AnalyzeRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    void router.replace('/')
  }, [router])
  return (
    <div style={{ maxWidth: 560, margin: '48px auto', fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim)' }}>
      Redirecting…
    </div>
  )
}
