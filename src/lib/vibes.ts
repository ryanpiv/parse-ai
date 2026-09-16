export const VIBE_STORAGE_KEY = 'parse-analyzer-vibe'

/**
 * Themes selectable in Settings. `slate` is the default (no data-vibe attribute —
 * :root in globals.css carries the slate palette). CSS overrides live in
 * `html[data-vibe="classic"|"light"]` blocks; keep both files in sync.
 */
export const VIBES = [
    { id: 'slate', name: 'Slate', blurb: 'Default dark — cool surfaces, blue accent.' },
    { id: 'classic', name: 'Gold HUD', blurb: 'High-contrast gold-on-black game overlay.' },
    { id: 'light', name: 'Light', blurb: 'Bright surfaces for daylight use.' },
] as const

export type VibeId = (typeof VIBES)[number]['id']

export function isVibeId(v: string): v is VibeId {
    return VIBES.some((x) => x.id === v)
}

export function applyVibe(id: VibeId) {
    if (typeof document === 'undefined') return
    if (id === 'slate') document.documentElement.removeAttribute('data-vibe')
    else document.documentElement.setAttribute('data-vibe', id)
    try {
        localStorage.setItem(VIBE_STORAGE_KEY, id)
    } catch {
        /* ignore */
    }
}

export function readStoredVibe(): VibeId {
    if (typeof window === 'undefined') return 'slate'
    try {
        const stored = localStorage.getItem(VIBE_STORAGE_KEY) || 'slate'
        return isVibeId(stored) ? stored : 'slate'
    } catch {
        return 'slate'
    }
}
