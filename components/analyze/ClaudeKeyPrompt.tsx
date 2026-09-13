import { pa } from '../../lib/styles'
import { requestClaudeKeySetup } from '../../lib/claudeKeyBus'

/** Shown inside Ask Claude when no Claude key is saved — sends the user to Settings. */
export function ClaudeKeyPrompt() {
  return (
    <div
      style={{
        border: '1px dashed var(--border)',
        borderRadius: 4,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <p style={{ margin: 0, flex: '1 1 260px', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
        Ask Claude uses your own Claude API key, stored only in this browser. Add a key to start
        asking questions about this fight.
      </p>
      <button type="button" className={pa.btnGold} onClick={requestClaudeKeySetup}>
        Add key in Settings
      </button>
    </div>
  )
}
