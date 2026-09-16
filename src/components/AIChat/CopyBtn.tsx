import { useState } from 'react'
import ui from '../../styles/ui.module.css'

export type CopyBtnProps = { text: string; label?: string }

const CopyBtn = ({ text, label = 'Copy' }: CopyBtnProps) => {
    const [copied, setCopied] = useState(false)

    function handleCopy() {
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
            onClick={handleCopy}
            className={`${ui.btnCopy}${copied ? ` ${ui.btnCopyCopied}` : ''}`}
        >
            {copied ? '✓ Copied' : label}
        </button>
    )
}

export default CopyBtn
