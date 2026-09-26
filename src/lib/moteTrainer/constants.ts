export const MOTE_NAME = 'MotE (Master of the Elements)'
export const TIER_4PC_NAME = 'four-piece tier set'
export const SWIFTNESS_NAME = 'Swiftness (Ancestral Swiftness)'

export const MS_MAX = 125
/** Elemental Blast is 90. Eye of the Storm brings it to 80. */
export const BLAST_COST = 80
/**
 * Midnight single-target line: Lava Burst while MotE is down once Maelstrom can fund the spender after it.
 * 52 - 5*Eye of the Storm*(1+Elemental Blast) + 30*Elemental Blast = 72 with both talents.
 */
export const LVB_MS_FOR_SPENDER = 72
export const CAP_WARN = 100
export const GCD = 1.5
export const SK_CD = 45
export const AS_CD = 30
export const ASC_CD = 180
export const EB_CD = 12
export const FS_DURATION = 18
export const LVB_CHARGES_MAX = 2
export const LVB_RECHARGE = 6

export const TRAINER_JUMPS = [
    { id: 'pre', label: 'Pre-pull', index: 0 },
    { id: 'fill', label: 'First filler', index: 23 },
    { id: 'sk', label: 'First Stormkeeper', index: 44 },
    { id: 'asc2', label: 'Second Ascendance', index: 119 },
] as const
