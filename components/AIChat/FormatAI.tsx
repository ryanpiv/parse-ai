import React, { useRef, useEffect } from 'react'

function formatInline(t: string): string {
  return t
    .replace(
      /\[([^\]]+)\]\(https?:\/\/www\.wowhead\.com\/spell=(\d+)[^)]*\)/g,
      '<a href="https://www.wowhead.com/spell=$2" target="_blank" rel="noreferrer" data-wh-spell="$2" data-wh-name="$1" style="color:var(--blue);text-decoration:none;border-bottom:1px dotted rgba(90,173,240,.5);cursor:help">$1</a>'
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong style="color:var(--gold);font-weight:500">$1</strong>'
    )
    .replace(
      /`([^`]+)`/g,
      '<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-size:11px;color:var(--blue)">$1</code>'
    )
}

export function FormatAI({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // no-op: event delegation handles tooltips globally
  })

  const lines = text.split('\n')
  const elements: React.ReactElement[] = []
  let listItems: string[] = []

  function flushList() {
    if (!listItems.length) return
    elements.push(
      <ul key={elements.length} style={{ paddingLeft: 18, margin: '6px 0' }}>
        {listItems.map((li, i) => (
          <li key={i} style={{ marginBottom: 4, color: 'var(--muted)' }} dangerouslySetInnerHTML={{ __html: li }} />
        ))}
      </ul>
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
          style={{
            fontFamily: 'Rajdhani,sans-serif', fontSize: 15, fontWeight: 600,
            color: 'var(--gold2)', margin: '14px 0 5px', letterSpacing: '.5px',
          }}
          dangerouslySetInnerHTML={{ __html: formatInline(headText) }}
        />
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
          style={{ marginBottom: 7, color: 'var(--muted)' }}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      )
    }
  })
  flushList()

  return <div ref={ref}>{elements}</div>
}
