/**
 * Shared UI primitives — the standard building blocks every page composes.
 * Use these instead of re-implementing panel/field/heading markup per page,
 * so layout and theming stay consistent (see ARCHITECTURE.md §8).
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { pa, s } from '../lib/styles'

/** Consistent page heading: title + optional one-line subtitle. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={s.hdr}>
      <div>
        <div style={s.logo}>{title}</div>
        {subtitle ? <div style={s.logoSub}>{subtitle}</div> : null}
      </div>
    </div>
  )
}

/** Standard content panel with optional title row and right-aligned actions. */
export function Panel({
  title,
  actions,
  children,
  style,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ ...s.panel, ...style }}>
      {title ? (
        <div style={{ ...s.ptitle, ...(actions ? { justifyContent: 'space-between', flexWrap: 'wrap' } : {}) }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={s.ptitleBar} />
            {title}
          </span>
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** Labeled control with an optional trailing action button column. */
export function FieldRow({
  label,
  action,
  children,
  style,
}: {
  label: ReactNode
  action?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: action ? '1fr auto' : '1fr', gap: 10, ...style }}>
      <div style={s.field}>
        <label style={s.label}>{label}</label>
        {children}
      </div>
      {action ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>{action}</div>
      ) : null}
    </div>
  )
}

/** Minimal disclosure row: caret + label toggles the body. */
export function Accordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'var(--label-tracking)',
          textTransform: 'var(--label-transform)' as CSSProperties['textTransform'],
          color: open ? 'var(--gold2)' : 'var(--muted)',
        }}
      >
        <span style={{ fontSize: 9, width: 10, display: 'inline-block' }}>{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </div>
  )
}

/** Horizontal divider with a small centered word (e.g. "or") between two options. */
export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 'var(--label-tracking)',
          textTransform: 'var(--label-transform)' as CSSProperties['textTransform'],
          color: 'var(--dim)',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

/**
 * Settings row for a secret: password input + Save button.
 * When a value is saved the field shows masked dots and a green status check.
 */
export function KeyField({
  label,
  value,
  onChange,
  onSave,
  saved,
  savedText = 'Saved',
  placeholder,
  buttonLabel = 'Save',
  note,
  highlight = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saved: boolean
  savedText?: string
  placeholder?: string
  buttonLabel?: string
  note?: ReactNode
  /** Briefly glow + focus the input (used when another part of the app sends the user here). */
  highlight?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (highlight) inputRef.current?.focus()
  }, [highlight])
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        <div style={s.field}>
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8 }}>
            {label}
            {saved && (
              <span style={{ color: 'var(--green)', letterSpacing: 0, textTransform: 'none', fontSize: 10 }}>
                ✓ {savedText}
              </span>
            )}
          </label>
          <input
            ref={inputRef}
            style={s.input}
            className={highlight ? 'paKeyGlow' : undefined}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSave()}
            placeholder={saved ? '••••••••••••••••' : placeholder}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button type="button" className={pa.btnGold} onClick={onSave}>
            {buttonLabel}
          </button>
        </div>
      </div>
      {note ? <div style={s.note}>{note}</div> : null}
    </div>
  )
}
