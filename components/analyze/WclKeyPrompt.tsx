import { useState } from 'react'
import { pa } from '../../lib/styles'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { startWclSignIn } from '../../lib/wclUserToken'

/**
 * Shown when the user isn't signed in to WCL — sign-in is required to load
 * reports (each user brings their own account, permissions, and rate limit).
 * Falls back to operator setup steps when the server has no client id.
 */
export function WclKeyPrompt() {
  const fa = useFightAnalysis()
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div
      style={{
        border: '1px dashed var(--border)',
        borderRadius: 4,
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <p
          style={{
            margin: 0,
            flex: '1 1 260px',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          {fa.wclClientId
            ? 'Sign in with your WarcraftLogs account to load reports. Loads use your own permissions (private logs included) and your own rate limit; the token stays in this browser.'
            : "This server isn't set up for WarcraftLogs sign-in yet, so reports can't load. The server owner sets this up once."}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fa.wclClientId && (
            <button type="button" className={pa.btnGold} onClick={() => void startWclSignIn(fa.wclClientId!)}>
              Sign in with WarcraftLogs
            </button>
          )}
          <button
            type="button"
            className={`${pa.btnGhost} ${pa.btnGhostSm}`}
            aria-expanded={showHelp}
            title="Server setup instructions"
            onClick={() => setShowHelp(o => !o)}
          >
            {showHelp ? 'Hide setup steps' : 'Server setup steps'}
          </button>
        </div>
      </div>
      {showHelp && (
        <ol
          style={{
            margin: '12px 0 0',
            paddingLeft: 20,
            fontFamily: 'var(--font-ui)',
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          <li>
            Sign in at warcraftlogs.com (a free account works), then create a client at{' '}
            <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
              warcraftlogs.com/api/clients
            </a>{' '}
            with redirect URL{' '}
            <code style={{ color: 'var(--blue)' }}>http://localhost:3000/auth/callback</code> (add your
            production URL too when deploying).
          </li>
          <li>
            Add <code style={{ color: 'var(--blue)' }}>WCL_CLIENT_ID</code> to{' '}
            <code style={{ color: 'var(--blue)' }}>.env.local</code> (or your host&apos;s environment
            variables). Public/PKCE clients have no secret; add{' '}
            <code style={{ color: 'var(--blue)' }}>WCL_CLIENT_SECRET</code> too only if your client is
            confidential.
          </li>
          <li>
            Restart the server. Every user then signs in with their own WarcraftLogs account (here or
            in Settings) to load reports.
          </li>
        </ol>
      )}
    </div>
  )
}
