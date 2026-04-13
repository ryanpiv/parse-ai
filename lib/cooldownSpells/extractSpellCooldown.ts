/**
 * Parse Blizzard Game Data API `/data/wow/spell/{id}` for a recovery/cooldown time in milliseconds.
 * Response shape has changed across API versions — try several paths.
 */
export function extractSpellCooldownMs(spell: Record<string, unknown> | null | undefined): number | null {
  if (!spell || typeof spell !== 'object') return null

  const cd = spell.cooldown
  if (cd && typeof cd === 'object' && 'value' in cd) {
    const v = (cd as { value?: unknown }).value
    if (typeof v === 'number' && v > 0) return v
  }

  for (const key of ['cooldown_duration', 'recovery_time', 'recoveryTime']) {
    const x = spell[key]
    if (typeof x === 'number' && x > 0) return x
  }

  return null
}
