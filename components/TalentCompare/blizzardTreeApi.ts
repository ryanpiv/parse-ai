import type { BlizzardNode } from './TalentTree'

/** JSON body from `GET /api/blizzard-tree?specId=…` (after error check). */
export type BlizzardTreePayload = {
    nodes: BlizzardNode[]
    edges: { from: number; to: number }[]
    heroTypes?: string[]
    specId?: number
    treeId?: number
    className?: string | null
    specName?: string | null
}

/**
 * Per-session client cache. Tree payloads are static data; without this, every
 * page mount (e.g. navigating away and back to /compare) refetched and re-rendered.
 */
const treeCache = new Map<number, Promise<BlizzardTreePayload>>()

export function fetchBlizzardTree(specId: number): Promise<BlizzardTreePayload> {
    const cached = treeCache.get(specId)
    if (cached) return cached
    const p = (async () => {
        const res = await fetch(`/api/blizzard-tree?specId=${specId}`)
        const data = (await res.json()) as BlizzardTreePayload & { error?: string }
        if (data.error) throw new Error(data.error)
        return data
    })()
    treeCache.set(specId, p)
    p.catch(() => treeCache.delete(specId))
    return p
}
