import { useState } from 'react'

export function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  function doCopy() {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
  }

  return (
    <button
      onClick={doCopy}
      style={{
        fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11,
        letterSpacing: '.8px', textTransform: 'uppercase', padding: '4px 10px',
        borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer',
        background: copied ? '#102a18' : 'var(--bg4)',
        color: copied ? 'var(--green)' : 'var(--dim)',
        transition: 'all .15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}
