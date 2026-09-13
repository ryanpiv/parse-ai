import { useEffect, useState } from 'react'
import { s } from '../lib/styles'
import { KeyField } from './ui'
import {
  looksLikeAnthropicKey,
  maskAnthropicKey,
  readAnthropicUserKey,
  writeAnthropicUserKey,
} from '../lib/anthropicUserKey'
import { announceClaudeKeyChanged } from '../lib/claudeKeyBus'

/** Settings row for the user's Claude Console key — stored in this browser's localStorage only. */
export function AnthropicKeyPanel({ highlight = false }: { highlight?: boolean }) {
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setSaved(readAnthropicUserKey())
  }, [])

  function save() {
    const t = draft.trim()
    if (!t) {
      if (!saved) {
        setMsg({ type: 'err', text: 'Paste a Console API key first.' })
        return
      }
      writeAnthropicUserKey('')
      setSaved('')
      setDraft('')
      setMsg({ type: 'ok', text: 'Key cleared.' })
      announceClaudeKeyChanged()
      return
    }
    if (!looksLikeAnthropicKey(t)) {
      setMsg({ type: 'err', text: 'That does not look like a Claude Console key (starts with sk-ant-).' })
      return
    }
    writeAnthropicUserKey(t)
    setSaved(t)
    setDraft('')
    setMsg({ type: 'ok', text: `Saved ${maskAnthropicKey(t)}.` })
    announceClaudeKeyChanged()
  }

  return (
    <div>
      <KeyField
        label="Claude API key"
        highlight={highlight}
        value={draft}
        onChange={setDraft}
        onSave={save}
        saved={Boolean(saved)}
        placeholder="sk-ant-api03-…"
        buttonLabel={!draft.trim() && saved ? 'Clear' : 'Save'}
        note={
          saved ? null : (
            <>
              Get a key at{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com/settings/keys
              </a>
              .
            </>
          )
        }
      />
      {msg && <div style={msg.type === 'err' ? s.alertErr : s.alertOk}>{msg.text}</div>}
    </div>
  )
}
