import { useState, useEffect } from 'react'
import { fetchBlizzardTree, type BlizzardTreePayload } from './blizzardTreeApi'

/**
 * Loads `/api/blizzard-tree` when `specId > 0` and `skip` is false.
 * Use `skip` while router/session gates are unresolved (e.g. talent-preview).
 */
export function useBlizzardTalentTree(
  specId: number,
  options?: { skip?: boolean }
): { tree: BlizzardTreePayload | null; loading: boolean; error: string | null } {
  const skip = options?.skip ?? false
  const shouldLoad = !skip && specId > 0

  const [tree, setTree] = useState<BlizzardTreePayload | null>(null)
  const [loading, setLoading] = useState(shouldLoad)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shouldLoad) {
      setTree(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setTree(null)
    setError(null)
    setLoading(true)

    fetchBlizzardTree(specId)
      .then(data => {
        if (!cancelled) setTree(data)
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [shouldLoad, specId])

  return { tree, loading, error }
}
