import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { s } from '../lib/styles'

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
  const fa = useFightAnalysis()

  const analyzeActive = path === '/' || path === '/analyze'

  return (
    <header style={{ borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 20px 0',
          display: 'flex',
          gap: 22,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/" style={linkStyle(analyzeActive)}>
          Analyze
        </Link>
        <Link href="/compare" style={linkStyle(path === '/compare')}>
          Talent compare
        </Link>
        <Link href="/talent-preview" style={linkStyle(path === '/talent-preview')}>
          P1 talents
        </Link>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 20px 14px' }}>
        {fa.authStatus === 'checking' && (
          <div style={s.panel}>
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim)' }}>
              Checking WarcraftLogs connection...
            </div>
          </div>
        )}
        {fa.authStatus === 'needed' && (
          <div style={s.panel}>
            <div style={s.ptitle}>
              <div style={s.ptitleBar} />
              Connect to WarcraftLogs
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
              <div style={s.field}>
                <label style={s.label}>WarcraftLogs Client ID</label>
                <input
                  style={s.input}
                  value={fa.clientId}
                  onChange={e => fa.setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onKeyDown={e => e.key === 'Enter' && fa.startAuth()}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <button style={s.btnGold} onClick={fa.startAuth}>
                  Authenticate
                </button>
              </div>
            </div>
            {fa.authMsg && (
              <div style={fa.authMsg.type === 'err' ? s.alertErr : s.alertInfo}>{fa.authMsg.msg}</div>
            )}
            <div style={s.note}>
              Create a public client at{' '}
              <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
                warcraftlogs.com/api/clients
              </a>{' '}
              with redirect URL{' '}
              <code
                style={{
                  background: 'var(--bg4)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  color: 'var(--blue)',
                }}
              >
                http://localhost:3000/auth/callback
              </code>
            </div>
          </div>
        )}
        {fa.authStatus === 'ok' && (
          <div
            style={{
              ...s.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 18px',
              marginBottom: 10,
            }}
          >
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--green)' }}>
              ● WarcraftLogs connected
            </div>
            <button style={s.btnGhost} onClick={() => fa.setAuthStatus('needed')}>
              Reconnect
            </button>
          </div>
        )}

        <div style={s.panel}>
          <div style={s.ptitle}>
            <div style={s.ptitleBar} />
            Warcraft Logs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
            <div style={s.field}>
              <label style={s.label}>Compare URL</label>
              <input
                style={s.input}
                value={fa.compareUrl}
                onChange={e => fa.setCompareUrl(e.target.value)}
                placeholder="https://www.warcraftlogs.com/reports/compare/..."
                onKeyDown={e => e.key === 'Enter' && !fa.loading && fa.loadCompare()}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button
                style={fa.loading ? s.btnGoldDis : s.btnGold}
                disabled={fa.loading}
                onClick={fa.loadCompare}
              >
                {fa.loading ? fa.loadStep || 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
          {fa.status && (
            <div
              style={
                fa.status.type === 'err'
                  ? s.alertErr
                  : fa.status.type === 'ok'
                    ? s.alertOk
                    : s.alertInfo
              }
            >
              {fa.status.msg}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
