import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { pa, s } from '../lib/styles'
import AnthropicKeyPanel from './AnthropicKeyPanel'
import { applyVibe, readStoredVibe, VIBES, type VibeId } from '../lib/vibes'
import { OPEN_CLAUDE_KEY_SETTINGS_EVENT } from '../lib/claudeKeyBus'
import { startWclSignIn, useWclUser, writeWclUser } from '../lib/wclUserToken'

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
                    <Link href="/reports" style={linkStyle(path === '/reports')}>
                        Reports
                    </Link>
                    <Link href="/history" style={linkStyle(path === '/history')}>
                        History
                    </Link>
                    <Link href="/compare" style={linkStyle(path === '/compare')}>
                        Talent compare
                    </Link>
                    <Link href="/talent-preview" style={linkStyle(path === '/talent-preview')}>
                        Talents
                    </Link>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen((o) => !o)}
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
                <SettingsMenu
                    onClose={() => setSettingsOpen(false)}
                    highlightClaudeKey={highlightClaudeKey}
                />
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
                            {VIBES.map((v) => (
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
                        <div style={s.label}>WarcraftLogs</div>
                        <WclAccountRow />
                    </div>

                    <AnthropicKeyPanel highlight={highlightClaudeKey} />
                </div>
            </div>
        </>
    )
}

/** Per-user WCL sign-in — required to load reports; each user brings their own account. */
function WclAccountRow() {
    const fa = useFightAnalysis()
    const user = useWclUser()

    if (user) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <span
                    style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--green, #4caf7d)' }}
                >
                    ✓ Signed in{user.userName ? ` as ${user.userName}` : ''}
                </span>
                <button
                    type="button"
                    className={`${pa.btnGhost} ${pa.btnGhostSm}`}
                    onClick={() => writeWclUser(null)}
                >
                    Sign out
                </button>
            </div>
        )
    }

    // Client id still being fetched — avoid flashing the "sign-in unavailable" note.
    if (fa.wclClientId === undefined) return null

    if (fa.wclClientId) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    className={pa.btnGold}
                    onClick={() => void startWclSignIn(fa.wclClientId!)}
                >
                    Sign in with WarcraftLogs
                </button>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--dim)' }}>
                    required to load reports — uses your account &amp; rate limit
                </span>
            </div>
        )
    }

    return (
        <p
            style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-ui)',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--muted)',
            }}
        >
            Sign-in unavailable: the server owner must set <code>WCL_CLIENT_ID</code> (from{' '}
            <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
                warcraftlogs.com/api/clients
            </a>
            ) in the server environment. <code>WCL_CLIENT_SECRET</code> is only needed for confidential
            clients.
        </p>
    )
}
