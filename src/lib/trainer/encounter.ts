/** Fight shapes a trainer can grow into. Only `single` is played today. */
export type TrainerEncounterMode = 'single' | 'cleave' | 'aoe'

export type TargetDebuff = {
    id: string
    label: string
    icon: string
    spellId?: number
    remains: number
    stacks: number | null
}

/** A rotation debuff the trainer knows how to time. The plate shows it only while it is up. */
export type TrackedDebuff = TargetDebuff

export type TrainerTarget = {
    id: string
    name: string
    debuffs: TargetDebuff[]
}

export type TrainerEncounter = {
    mode: TrainerEncounterMode
    targets: TrainerTarget[]
}

export const ENCOUNTER_MODES: { id: TrainerEncounterMode; label: string }[] = [
    { id: 'single', label: 'Single target' },
    { id: 'cleave', label: 'Cleave' },
    { id: 'aoe', label: 'AoE' },
]

const ICON_ROOT = 'https://wow.zamimg.com/images/wow/icons/large'

export const wowIconUrl = (file: string): string => `${ICON_ROOT}/${file}.jpg`

export const formatDebuffTimer = (seconds: number): string => {
    if (seconds >= 10) return String(Math.floor(seconds))
    return seconds.toFixed(1)
}

export const encounterModeLabel = (mode: TrainerEncounterMode): string =>
    ENCOUNTER_MODES.find((entry) => entry.id === mode)?.label ?? mode

/** Nameplate rule: a debuff is on the target only while time remains. */
export const appliedDebuffs = (tracked: TrackedDebuff[]): TargetDebuff[] =>
    tracked.filter((debuff) => debuff.remains > 0)
