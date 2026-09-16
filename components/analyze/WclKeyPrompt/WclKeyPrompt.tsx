import { useState } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { useFightAnalysis } from '../../../contexts/FightAnalysisContext'
import { startWclSignIn } from '../../../lib/wclUserToken'

/**
 * Shown when the user isn't signed in to WCL — sign-in is required to load
 * reports (each user brings their own account, permissions, and rate limit).
 * Falls back to operator setup steps when the server has no client id.
 */
const WclKeyPrompt = () => {
    const fa = useFightAnalysis()
    const [showHelp, setShowHelp] = useState(false)

    // Client id still being fetched — don't flash the "server not set up" fallback.
    if (fa.wclClientId === undefined) return null

    if (fa.wclClientId) {
        return (
            <div className={styles.signInBox}>
                <div className={`${ui.label} ${styles.signInTitle}`}>WarcraftLogs sign-in required</div>
                <button
                    type="button"
                    className={`${ui.btnGold} ${styles.signInButton}`}
                    onClick={() => void startWclSignIn(fa.wclClientId!)}
                >
                    Sign in with WarcraftLogs
                </button>
                <p className={styles.signInBlurb}>
                    One click, free account — loads use your own permissions (private logs included) and your
                    own rate limit. The token stays in this browser.
                </p>
            </div>
        )
    }

    // Operator-facing fallback — the server has no WCL_CLIENT_ID, so sign-in is impossible.
    return (
        <div className={styles.setupBox}>
            <div className={styles.setupRow}>
                <p className={styles.setupBlurb}>
                    This server isn&apos;t set up for WarcraftLogs sign-in yet, so reports can&apos;t load.
                    The server owner sets this up once.
                </p>
                <button
                    type="button"
                    className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                    aria-expanded={showHelp}
                    title="Server setup instructions"
                    onClick={() => setShowHelp((o) => !o)}
                >
                    {showHelp ? 'Hide setup steps' : 'Server setup steps'}
                </button>
            </div>
            {showHelp && (
                <ol className={styles.setupSteps}>
                    <li>
                        Sign in at warcraftlogs.com (a free account works), then create a client at{' '}
                        <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">
                            warcraftlogs.com/api/clients
                        </a>{' '}
                        with redirect URL{' '}
                        <code className={styles.codeBlue}>http://localhost:3000/auth/callback</code> (add your
                        production URL too when deploying).
                    </li>
                    <li>
                        Add <code className={styles.codeBlue}>WCL_CLIENT_ID</code> to{' '}
                        <code className={styles.codeBlue}>.env.local</code> (or your host&apos;s environment
                        variables). Public/PKCE clients have no secret; add{' '}
                        <code className={styles.codeBlue}>WCL_CLIENT_SECRET</code> too only if your client is
                        confidential.
                    </li>
                    <li>
                        Restart the server. Every user then signs in with their own WarcraftLogs account (here
                        or in Settings) to load reports.
                    </li>
                </ol>
            )}
        </div>
    )
}

export default WclKeyPrompt
