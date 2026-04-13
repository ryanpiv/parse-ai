/**
 * Spell IDs to always treat as major cooldowns for the compare chart when Blizzard
 * returns no/zero cooldown (common for some generator spells) or you want to force-show.
 * Patch-specific — add Frozen Orb, Combustion, etc. if needed.
 */
export const MANUAL_COOLDOWN_SPELL_IDS = new Set<number>([
  // Example (retail IDs change): 190356 — Frozen Orb (verify each patch)
])
