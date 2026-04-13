import { blizzardGet } from '../blizzardClient'
import { extractSpellCooldownMs } from './extractSpellCooldown'

/** Resolve cooldown (ms) for many spell ids; failures → null for that id. */
export async function fetchSpellCooldownsMs(
  ids: number[],
  opts?: { concurrency?: number }
): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>()
  const unique = [...new Set(ids.filter(n => Number.isFinite(n) && n > 0))].slice(0, 48)
  const concurrency = Math.max(1, Math.min(8, opts?.concurrency ?? 6))

  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency)
    await Promise.all(
      chunk.map(async id => {
        try {
          const spell = await blizzardGet(`/data/wow/spell/${id}`, 'static')
          const ms = extractSpellCooldownMs(spell as Record<string, unknown>)
          out.set(id, ms)
        } catch {
          out.set(id, null)
        }
      })
    )
  }

  return out
}
