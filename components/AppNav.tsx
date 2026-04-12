import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const linkStyle = (active: boolean): CSSProperties => ({
  fontFamily: 'Rajdhani, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  color: active ? 'var(--gold2)' : 'var(--dim)',
  borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
  paddingBottom: 2,
})

export function AppNav() {
  const router = useRouter()
  const path = router.pathname || ''

  return (
    <nav
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '12px 20px 0',
        display: 'flex',
        gap: 22,
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        marginBottom: 0,
      }}
    >
      <Link href="/" style={linkStyle(path === '/')}>
        Analyze
      </Link>
      <Link href="/compare" style={linkStyle(path === '/compare')}>
        Talent compare
      </Link>
      <Link href="/talent-preview" style={linkStyle(path === '/talent-preview')}>
        P1 talents
      </Link>
    </nav>
  )
}
