import { Component, type ErrorInfo, type ReactNode } from 'react'
import ui from '../../styles/ui.module.css'
import styles from './styles.module.css'

export type AppErrorBoundaryProps = {
    children: ReactNode
}

type AppErrorBoundaryState = {
    error: Error | null
}

/**
 * Last-resort catch for uncaught render errors: a brief "what broke" message
 * instead of a blank page or raw stack. Recoverable via reload.
 * (Class component — React error boundaries have no hook equivalent.)
 */
class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
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
            <div className={styles.box}>
                <p className={styles.title}>Something went wrong rendering this page.</p>
                <p className={styles.detail}>{this.state.error.message || 'Unknown error'}</p>
                <button type="button" className={ui.btnGold} onClick={() => window.location.reload()}>
                    Reload
                </button>
            </div>
        )
    }
}

export default AppErrorBoundary
