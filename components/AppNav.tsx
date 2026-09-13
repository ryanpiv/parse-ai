import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { pa, s } from '../lib/styles'
import { KeyField } from './ui'
import { AnthropicKeyPanel } from './AnthropicKeyPanel'
import { applyVibe, readStoredVibe, VIBES, type VibeId } from '../lib/vibes'
import { OPEN_CLAUDE_KEY_SETTINGS_EVENT } from '../lib/claudeKeyBus'

const linkStyle = (active: boolean): CSSProperties => ({
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--label-tracking)',
  textTransform: 'var(--label-transform)' as CSSProperties['textTransform'],
  textDecoration: 'none',
  color: active ? 'var(--gold2)' : 'var(--dim)',
  borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
  paddingBottom: 2,
})

export function AppNav() {
  const router = useRouter()
  const path = router.pathname || ''
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [highlightClaudeKey, setHighlightClaudeKey] = useState(false)

  // "Add your key" buttons elsewhere open Settings and pulse the Claude key field.
  useEffect(() => {
    const onOpenClaudeKey = () => {
      setSettingsOpen(true)
      setHighlightClaudeKey(true)
      window.setTimeout(() => setHighlightClaudeKey(false), 2600)
    }
    window.addEventListener(OPEN_CLAUDE_KEY_SETTINGS_EVENT, onOpenClaudeKey)
    return () => window.removeEventListener(OPEN_CLAUDE_KEY_SETTINGS_EVENT, onOpenClaudeKey)
  }, [])

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
          <button
            type="button"
            onClick={() => setSettingsOpen(o => !o)}
            aria-expanded={settingsOpen}
            style={{
              ...linkStyle(settingsOpen),
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              borderBottom: settingsOpen ? '2px solid var(--gold)' : '2px solid transparent',
              cursor: 'pointer',
              padding: '0 0 2px',
            }}
          >
            Settings
          </button>
        </nav>
      </div>
      <div className={pa.appNavTabsSpacer} aria-hidden />

      {settingsOpen && (
        <SettingsMenu onClose={() => setSettingsOpen(false)} highlightClaudeKey={highlightClaudeKey} />
      )}
    </header>
  )
}

function SettingsMenu({
  onClose,
  highlightClaudeKey = false,
}: {
  onClose: () => void
  highlightClaudeKey?: boolean
}) {
  const fa = useFightAnalysis()
  const [vibe, setVibe] = useState<VibeId>('slate')

  useEffect(() => {
    setVibe(readStoredVibe())
  }, [])

  function pickVibe(id: VibeId) {
    applyVibe(id)
    setVibe(id)
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          top: 'var(--pa-sticky-app-nav-offset)',
          zIndex: 48,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 'var(--pa-sticky-app-nav-offset)',
          right: 0,
          zIndex: 49,
          width: 'min(480px, calc(100vw - 24px))',
          padding: '10px 12px',
        }}
      >
        <div style={{ ...s.panel, boxShadow: '0 10px 32px rgba(0,0,0,0.45)' }}>
          <div style={s.ptitle}>
            <div style={s.ptitleBar} />
            Settings
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={s.label}>Theme</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {VIBES.map(v => (
                <label
                  key={v.id}
                  title={v.blurb}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="pa-theme"
                    checked={vibe === v.id}
                    onChange={() => pickVibe(v.id)}
                    style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                  />
                  {v.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <KeyField
              label="WarcraftLogs client ID"
              value={fa.clientId}
              onChange={fa.setClientId}
              onSave={() => void fa.startAuth()}
              saved={fa.authStatus === 'ok'}
              savedText="Connected"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              note={
                fa.authStatus === 'ok' ? null : fa.authStatus === 'checking' ? (
                  'Checking connection…'
                ) : (
                  <>
                    Create a public client at{' '}
                    <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
                      warcraftlogs.com/api/clients
                    </a>{' '}
                    (redirect URL <code>http://localhost:3000/auth/callback</code>). Saving opens WarcraftLogs to
                    authorize.
                  </>
                )
              }
            />
            {fa.authMsg && (
              <div style={fa.authMsg.type === 'err' ? s.alertErr : s.alertInfo}>{fa.authMsg.msg}</div>
            )}
          </div>

          <AnthropicKeyPanel highlight={highlightClaudeKey} />
        </div>
      </div>
    </>
  )
}
