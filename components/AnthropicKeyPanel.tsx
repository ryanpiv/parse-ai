import { useEffect, useState } from 'react'
import { pa, s } from '../lib/styles'
import {
  looksLikeAnthropicKey,
  maskAnthropicKey,
  readAnthropicUserKey,
  writeAnthropicUserKey,
} from '../lib/anthropicUserKey'

export function AnthropicKeyPanel() {
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const k = readAnthropicUserKey()
    setSaved(k)
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
      setMsg({
        type: 'ok',
        text: 'Cleared. Chat will use a server key if one is configured, otherwise it will fail until you paste a key.',
      })
      return
    }
    if (!looksLikeAnthropicKey(t)) {
      setMsg({ type: 'err', text: 'That does not look like a Claude Console key (starts with sk-ant-). Get one at console.anthropic.com — not claude.ai.' })
      return
    }
    writeAnthropicUserKey(t)
    setSaved(t)
    setDraft('')
    setMsg({ type: 'ok', text: `Saved in this browser as ${maskAnthropicKey(t)}. Requests go to Anthropic with your key; it is not stored on the server.` })
  }

  return (
    <div style={s.panel}>
      <div style={s.ptitle}>
        <div style={s.ptitleBar} />
        Claude API key
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 8 }}>
        <div style={s.field}>
          <label style={s.label}>Console API key</label>
          <input
            style={s.input}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={saved ? maskAnthropicKey(saved) : 'sk-ant-api03-…'}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className={pa.btnGold} onClick={save}>
            {draft.trim() ? 'Save key' : saved ? 'Clear key' : 'Save key'}
          </button>
        </div>
      </div>
      {saved ? (
        <div style={s.note}>Using {maskAnthropicKey(saved)} from this browser.</div>
      ) : (
        <div style={s.note}>
          Paste a key from{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com/settings/keys
          </a>
          . Claude.ai / Pro login is not allowed for third-party sites — Console API keys are the supported path.
        </div>
      )}
      {msg && <div style={msg.type === 'err' ? s.alertErr : s.alertOk}>{msg.text}</div>}
    </div>
  )
}
