import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import ui from '../../styles/ui.module.css'
import styles from './styles.module.css'
import AnthropicKeyPanel from '../AnthropicKeyPanel'
import { applyVibe, readStoredVibe, VIBES, type VibeId } from '../../lib/vibes'
import { OPEN_CLAUDE_KEY_SETTINGS_EVENT } from '../../lib/claudeKeyBus'
import { startWclSignIn, useWclUser, writeWclUser } from '../../lib/wclUserToken'

const linkClass = (active: boolean): string =>
    active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

const AppNav = () => {
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
        <header className={styles.header}>
            <div className={ui.appNavTabs}>
                <nav>
                    <Link href="/" className={linkClass(analyzeActive)}>
                        Analyze
                    </Link>
                    <Link href="/reports" className={linkClass(path === '/reports')}>
                        Reports
                    </Link>
                    <Link href="/history" className={linkClass(path === '/history')}>
                        History
                    </Link>
                    <Link href="/compare" className={linkClass(path === '/compare')}>
                        Talent compare
                    </Link>
                    <Link href="/talent-preview" className={linkClass(path === '/talent-preview')}>
                        Talents
                    </Link>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen((o) => !o)}
                        aria-expanded={settingsOpen}
                        className={`${linkClass(settingsOpen)} ${styles.settingsButton}`}
                    >
                        Settings
                    </button>
                </nav>
            </div>
            <div className={ui.appNavTabsSpacer} aria-hidden />

            {settingsOpen && (
                <SettingsMenu
                    onClose={() => setSettingsOpen(false)}
                    highlightClaudeKey={highlightClaudeKey}
                />
            )}
        </header>
    )
}

interface ISettingsMenuProps {
    onClose: () => void
    highlightClaudeKey?: boolean
}

const SettingsMenu = ({ onClose, highlightClaudeKey = false }: ISettingsMenuProps) => {
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
            <div onClick={onClose} className={styles.overlay} />
            <div className={styles.settingsDock}>
                <div className={`${ui.panel} ${styles.settingsPanel}`}>
                    <div className={ui.ptitle}>
                        <div className={ui.ptitleBar} />
                        Settings
                    </div>

                    <div className={styles.settingsSection}>
                        <div className={ui.label}>Theme</div>
                        <div className={styles.themeRow}>
                            {VIBES.map((v) => (
                                <label key={v.id} title={v.blurb} className={styles.vibeOption}>
                                    <input
                                        type="radio"
                                        name="pa-theme"
                                        checked={vibe === v.id}
                                        onChange={() => pickVibe(v.id)}
                                        className={styles.vibeRadio}
                                    />
                                    {v.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.settingsSection}>
                        <div className={ui.label}>WarcraftLogs</div>
                        <WclAccountRow />
                    </div>

                    <AnthropicKeyPanel highlight={highlightClaudeKey} />
                </div>
            </div>
        </>
    )
}

/** Per-user WCL sign-in — required to load reports; each user brings their own account. */
const WclAccountRow = () => {
    const fa = useFightAnalysis()
    const user = useWclUser()

    if (user) {
        return (
            <div className={styles.accountRow}>
                <span className={styles.signedInNote}>
                    ✓ Signed in{user.userName ? ` as ${user.userName}` : ''}
                </span>
                <button
                    type="button"
                    className={`${ui.btnGhost} ${ui.btnGhostSm}`}
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
            <div className={styles.accountRow}>
                <button
                    type="button"
                    className={ui.btnGold}
                    onClick={() => void startWclSignIn(fa.wclClientId!)}
                >
                    Sign in with WarcraftLogs
                </button>
                <span className={styles.signInHint}>
                    required to load reports — uses your account &amp; rate limit
                </span>
            </div>
        )
    }

    return (
        <p className={styles.unavailableNote}>
            Sign-in unavailable: the server owner must set <code>WCL_CLIENT_ID</code> (from{' '}
            <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
                warcraftlogs.com/api/clients
            </a>
            ) in the server environment. <code>WCL_CLIENT_SECRET</code> is only needed for confidential
            clients.
        </p>
    )
}

export default AppNav
