import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { requestClaudeKeySetup } from '../../../lib/claudeKeyBus'

/** Shown inside Ask Claude when no Claude key is saved — sends the user to Settings. */
const ClaudeKeyPrompt = () => {
    return (
        <div className={styles.prompt}>
            <p className={styles.blurb}>
                Ask Claude uses your own Claude API key, stored only in this browser. Add a key to start
                asking questions about this fight.
            </p>
            <button type="button" className={ui.btnGold} onClick={requestClaudeKeySetup}>
                Add key in Settings
            </button>
        </div>
    )
}

export default ClaudeKeyPrompt
