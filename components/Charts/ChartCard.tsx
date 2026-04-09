import type { ReactNode } from 'react'

export function ChartCard(props: {
  title: string
  height?: number
  children?: ReactNode
}) {
  const { title, height = 220, children } = props
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ height, position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
