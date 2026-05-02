import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { pa, s } from '../lib/styles'

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
    <header style={{ marginBottom: 0 }}>
      <div className={pa.appNavTabs}>
        <nav>
          <Link href="/" style={linkStyle(analyzeActive)}>
            Analyze
          </Link>
          <Link href="/compare" style={linkStyle(path === '/compare')}>
            Talent compare
          </Link>
          <Link href="/talent-preview" style={linkStyle(path === '/talent-preview')}>
            Talents
          </Link>
        </nav>
      </div>
      <div className={pa.appNavTabsSpacer} aria-hidden />

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
                <button type="button" className={pa.btnGold} onClick={fa.startAuth}>
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
            <button type="button" className={pa.btnGhost} onClick={() => fa.setAuthStatus('needed')}>
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
              <label style={s.label}>Report or compare URL</label>
              <input
                style={s.input}
                value={fa.compareUrl}
                onChange={e => fa.setCompareUrl(e.target.value)}
                placeholder="https://www.warcraftlogs.com/reports/… or …/compare/…"
                onKeyDown={e => e.key === 'Enter' && !fa.loading && fa.loadCompare()}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button type="button" className={pa.btnGold} disabled={fa.loading} onClick={fa.loadCompare}>
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
          {fa.soloPlayerChoices.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontFamily: 'Rajdhani,sans-serif',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.8px',
                  textTransform: 'uppercase',
                  color: 'var(--dim)',
                  marginBottom: 8,
                }}
              >
                {fa.p1data && fa.soloFromReport ? 'Switch character (solo)' : 'Select character (solo)'}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {fa.soloPlayerChoices.map(p => {
                  const active = fa.soloRosterSelectedPlayerId === p.id
                  return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={fa.loading}
                    onClick={() => void fa.confirmSoloReportPlayer(String(p.id))}
                    className={`${pa.rosterPick}${active ? ` ${pa.rosterPickActive}` : ''}`}
                    title={`${p.role} · ${p.className}`}
                  >
                    {p.iconUrl ? (
                      <img src={p.iconUrl} alt="" width={24} height={24} style={{ borderRadius: 3, flexShrink: 0 }} />
                    ) : (
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 3,
                          background: 'var(--bg4)',
                          flexShrink: 0,
                          display: 'inline-block',
                        }}
                      />
                    )}
                    <span>
                      <span style={{ color: 'var(--gold2)', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                        {p.specLabel}
                      </span>
                    </span>
                  </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
