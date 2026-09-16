/**
 * Tiny window-event bus around the browser-stored Claude key so distant
 * components (Ask Claude sections ↔ Settings menu in AppNav) stay in sync
 * without threading props through the page tree.
 */
import { useEffect, useState } from 'react'
import { readAnthropicUserKey } from './anthropicUserKey'

/** Fired by the Settings key panel whenever the saved key changes. */
export const CLAUDE_KEY_CHANGED_EVENT = 'pa:claude-key-changed'
/** Fired by "add your key" buttons; AppNav opens Settings and highlights the key field. */
export const OPEN_CLAUDE_KEY_SETTINGS_EVENT = 'pa:open-claude-key-settings'

export function announceClaudeKeyChanged(): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event(CLAUDE_KEY_CHANGED_EVENT))
}

export function requestClaudeKeySetup(): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event(OPEN_CLAUDE_KEY_SETTINGS_EVENT))
}

/** True once a Claude key is saved in this browser; updates live on save/clear. */
export function useClaudeKeyPresent(): boolean {
    const [present, setPresent] = useState(
        () => typeof window !== 'undefined' && Boolean(readAnthropicUserKey()),
    )
    useEffect(() => {
        const update = () => setPresent(Boolean(readAnthropicUserKey()))
        update()
        window.addEventListener(CLAUDE_KEY_CHANGED_EVENT, update)
        window.addEventListener('storage', update)
        return () => {
            window.removeEventListener(CLAUDE_KEY_CHANGED_EVENT, update)
            window.removeEventListener('storage', update)
        }
    }, [])
    return present
}
