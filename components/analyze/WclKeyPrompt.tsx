import { useState } from 'react'
import { pa } from '../../lib/styles'
import { requestWclKeySetup } from '../../lib/claudeKeyBus'

/**
 * Shown when no WarcraftLogs client ID is connected — sends the user to
 * Settings (field glows), with a toggleable how-to for getting a client ID.
 */
export function WclKeyPrompt() {
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
          Loading reports needs a free WarcraftLogs API client ID, stored only in this browser.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className={pa.btnGold} onClick={requestWclKeySetup}>
            Add client ID in Settings
          </button>
          <button
            type="button"
            className={`${pa.btnGhost} ${pa.btnGhostSm}`}
            aria-expanded={showHelp}
            title="How do I get a client ID?"
            onClick={() => setShowHelp(o => !o)}
          >
            {showHelp ? 'Hide help' : 'How do I get one?'}
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
            Sign in at warcraftlogs.com (a free account works), then open{' '}
            <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
              warcraftlogs.com/api/clients
            </a>
            .
          </li>
          <li>
            Create a client — any name, redirect URL{' '}
            <code style={{ color: 'var(--blue)' }}>http://localhost:3000/auth/callback</code>, and check{' '}
            <strong style={{ color: 'var(--text)' }}>public client</strong>.
          </li>
          <li>
            Copy the client ID into Settings and Save — WarcraftLogs opens once so you can authorize
            this app.
          </li>
        </ol>
      )}
    </div>
  )
}
