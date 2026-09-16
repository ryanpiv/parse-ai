import { Component, type ErrorInfo, type ReactNode } from 'react'
import { pa } from '../lib/styles'

/**
 * Last-resort catch for uncaught render errors: a brief "what broke" message
 * instead of a blank page or raw stack. Recoverable via reload.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Something went wrong rendering this page.
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          {this.state.error.message || 'Unknown error'}
        </p>
        <button type="button" className={pa.btnGold} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
