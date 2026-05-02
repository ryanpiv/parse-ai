import { useState } from 'react'
import { pa } from '../../lib/styles'

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
      type="button"
      onClick={doCopy}
      className={`${pa.btnCopy}${copied ? ` ${pa.btnCopyCopied}` : ''}`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}
