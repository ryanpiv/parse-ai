import React from 'react'
import styles from './styles.module.css'

export type FormatAIProps = { text: string }

function formatInline(t: string): string {
    return t
        .replace(
            /\[([^\]]+)\]\(https?:\/\/www\.wowhead\.com\/spell=(\d+)[^)]*\)/g,
            '<a href="https://www.wowhead.com/spell=$2" target="_blank" rel="noreferrer" data-wh-spell="$2" data-wh-name="$1" style="color:var(--blue);text-decoration:none;border-bottom:1px dotted rgba(90,173,240,.5);cursor:help">$1</a>',
        )
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--gold);font-weight:500">$1</strong>')
        .replace(
            /`([^`]+)`/g,
            '<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-size:11px;color:var(--blue)">$1</code>',
        )
}

/** Renders Claude's markdown-ish reply (headings, bullets, inline spell links). Tooltips come from global event delegation. */
const FormatAI = ({ text }: FormatAIProps) => {
    const lines = text.split('\n')
    const elements: React.ReactElement[] = []
    let listItems: string[] = []

    function flushList() {
        if (!listItems.length) return
        elements.push(
            <ul key={elements.length} className={styles.bulletList}>
                {listItems.map((li, i) => (
                    <li key={i} className={styles.bulletItem} dangerouslySetInnerHTML={{ __html: li }} />
                ))}
            </ul>,
        )
        listItems = []
    }

    lines.forEach((line, i) => {
        if (line.startsWith('### ') || line.startsWith('## ')) {
            flushList()
            const headText = line.replace(/^#+\s/, '').replace(/\*\*/g, '')
            elements.push(
                <h3
                    key={i}
                    className={styles.heading}
                    dangerouslySetInnerHTML={{ __html: formatInline(headText) }}
                />,
            )
        } else if (line.startsWith('- ')) {
            listItems.push(formatInline(line.slice(2)))
        } else if (line.trim() === '') {
            flushList()
        } else {
            flushList()
            elements.push(
                <p
                    key={i}
                    className={styles.paragraph}
                    dangerouslySetInnerHTML={{ __html: formatInline(line) }}
                />,
            )
        }
    })
    flushList()

    return <div>{elements}</div>
}

export default FormatAI
