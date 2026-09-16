/**
 * Load history — a small localStorage list of every solo/compare the user has
 * loaded, newest first. Entries are deduped by canonical WCL URL: re-loading
 * an existing entry bumps it to the top (accessedAt refreshed) instead of
 * duplicating. Only IDs + display labels are stored, never fight data.
 */

export interface AnalysisHistoryEntry {
    /** Canonical WCL URL — the dedupe key and what gets re-loaded on click. */
    url: string
    kind: 'solo' | 'compare'
    name1: string
    spec1?: string
    name2?: string
    spec2?: string
    boss: string
    /** Last load time (ms epoch) — list is sorted by this. */
    accessedAt: number
}

const KEY = 'parse-analyzer-history'
const MAX_ENTRIES = 50

/** Fired on window whenever the history list changes (same-tab reactivity). */
export const HISTORY_CHANGED_EVENT = 'parse-analyzer-history-changed'

export function readHistory(): AnalysisHistoryEntry[] {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(
            (e: any): e is AnalysisHistoryEntry =>
                e &&
                typeof e.url === 'string' &&
                (e.kind === 'solo' || e.kind === 'compare') &&
                typeof e.accessedAt === 'number',
        )
    } catch {
        return []
    }
}

function write(entries: AnalysisHistoryEntry[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
        window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT))
    } catch {
        /* private mode / quota — history is best-effort */
    }
}

/** Add a load to history, or bump an existing entry with the same URL to the top. */
export function recordHistory(entry: Omit<AnalysisHistoryEntry, 'accessedAt'>): void {
    const rest = readHistory().filter((e) => e.url !== entry.url)
    write([{ ...entry, accessedAt: Date.now() }, ...rest])
}

export function clearHistory(): void {
    write([])
}
