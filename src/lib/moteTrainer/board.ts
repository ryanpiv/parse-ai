import {
    AS_CD,
    ASC_CD,
    BLAST_COST,
    CAP_WARN,
    EB_CD,
    FS_DURATION,
    GCD,
    LVB_CHARGES_MAX,
    LVB_MS_FOR_SPENDER,
    LVB_RECHARGE,
    MOTE_NAME,
    MS_MAX,
    SK_CD,
} from './constants'
import type { CondId, TrainerBoard, TrainerStep } from './types'

export type CastSpec = {
    name: string
    label: string
}

export const CAST_SPECS: CastSpec[] = [
    { name: 'lightning_bolt', label: 'Lightning Bolt' },
    { name: 'lava_burst', label: 'Lava Burst' },
    { name: 'elemental_blast', label: 'Elemental Blast' },
    { name: 'flame_shock', label: 'Flame Shock' },
    { name: 'ancestral_swiftness', label: 'Ancestral Swiftness' },
    { name: 'stormkeeper', label: 'Stormkeeper' },
    { name: 'ascendance', label: 'Ascendance' },
]

const lastPress = (steps: TrainerStep[], index: number, names: string[]): number | null => {
    for (let j = index - 1; j >= 0; j--) {
        if (names.includes(steps[j].name)) return steps[j].t
    }
    return null
}

const cooldown = (
    steps: TrainerStep[],
    index: number,
    name: string,
    defaultCd: number,
): { remains: number; ready: boolean } => {
    const now = steps[index].t
    if (steps[index].name === name) return { remains: 0, ready: true }
    const previous = lastPress(steps, index, [name])
    if (previous === null) return { remains: 0, ready: true }
    const remains = Math.max(0, defaultCd - (now - previous))
    return { remains, ready: remains === 0 }
}

export const inferLvbCharges = (
    steps: TrainerStep[],
    index: number,
): { charges: number; rechargeRemains: number } => {
    const now = steps[index].t
    const slots = [-1e9, -1e9]
    for (let j = 0; j < index; j++) {
        if (steps[j].name !== 'lava_burst') continue
        let slot = slots.findIndex((readyAt) => readyAt <= steps[j].t)
        if (slot < 0) slot = slots[0] <= slots[1] ? 0 : 1
        slots[slot] = steps[j].t + LVB_RECHARGE
    }
    const ready = slots.filter((readyAt) => readyAt <= now).length
    const nextReady = slots.filter((readyAt) => readyAt > now).sort((a, b) => a - b)[0]
    const rechargeRemains = nextReady === undefined ? 0 : nextReady - now
    const step = steps[index]
    // A filler bolt with room in Maelstrom means charges were not about to cap.
    // The flat recharge timer gets ahead of the sample and would show 2/2 here.
    const building = step.name === 'lightning_bolt' && !step.mote && !step.surge && MS_MAX - step.ms > 15
    const charges = building ? Math.min(ready, LVB_CHARGES_MAX - 1) : ready
    const hasBurst = step.name === 'lava_burst' || step.surge
    return { charges: hasBurst ? Math.max(charges, 1) : charges, rechargeRemains }
}

const swiftnessSitting = (steps: TrainerStep[], index: number): boolean => {
    for (let j = index - 1; j >= 0; j--) {
        if (steps[j].name !== 'ancestral_swiftness') continue
        for (let k = j + 1; k < index; k++) {
            if (steps[k].dur > 1.0) return false
            const why = steps[k].why
            if (why.includes('Swiftness') && (why.includes('eats') || why.includes('spends'))) return false
        }
        return true
    }
    return false
}

const flagRemains = (
    steps: TrainerStep[],
    index: number,
    isUp: (step: TrainerStep) => boolean,
): number | null => {
    if (!isUp(steps[index])) return null
    const start = steps[index].t
    for (let j = index + 1; j < steps.length; j++) {
        if (!isUp(steps[j])) return Math.max(0, steps[j].t - start)
    }
    const last = steps[steps.length - 1]
    return Math.max(0, last.t + last.dur - start)
}

const sittingRemains = (steps: TrainerStep[], index: number): number | null => {
    if (!swiftnessSitting(steps, index)) return null
    const start = steps[index].t
    for (let j = index + 1; j < steps.length; j++) {
        if (!swiftnessSitting(steps, j)) return Math.max(0, steps[j].t - start)
    }
    const last = steps[steps.length - 1]
    return Math.max(0, last.t + last.dur - start)
}

export const formatWowTimer = (seconds: number): string => {
    if (seconds >= 10) return String(Math.floor(seconds))
    return seconds.toFixed(1)
}

export const buildBoard = (steps: TrainerStep[], index: number): TrainerBoard => {
    const now = steps[index]
    const fightEnd = steps[steps.length - 1].t + steps[steps.length - 1].dur
    const sk = cooldown(steps, index, 'stormkeeper', SK_CD)
    const swift = cooldown(steps, index, 'ancestral_swiftness', AS_CD)
    const asc = cooldown(steps, index, 'ascendance', ASC_CD)
    const blast = cooldown(steps, index, 'elemental_blast', EB_CD)
    const applied = lastPress(steps, index, ['flame_shock', 'ascendance'])
    const fsAge = applied === null ? null : now.t - applied
    const fsRemains = fsAge === null ? 0 : Math.max(0, FS_DURATION - fsAge)
    const lvb = inferLvbCharges(steps, index)

    return {
        ms: now.ms,
        deficit: MS_MAX - now.ms,
        mote: now.mote,
        surge: now.surge,
        sk: now.sk,
        anc: now.anc,
        ascUp: now.asc,
        skCd: sk.remains,
        asCd: swift.remains,
        ascCd: asc.remains,
        ebCd: blast.remains,
        skReady: sk.ready,
        asReady: swift.ready,
        ascReady: asc.ready,
        ebReady: blast.ready,
        fsRefresh: now.name === 'flame_shock' || now.why.includes('Flame Shock refreshable'),
        fsAge,
        fsRemains,
        potm: now.why.includes('Power of the Maelstrom'),
        empowered4pc: now.why.includes('four-piece tier set'),
        swiftness: swiftnessSitting(steps, index),
        fightRemains: Math.max(0, fightEnd - now.t),
        prepull: now.t < 0,
        phase: now.phase,
        moteRemains: flagRemains(steps, index, (step) => step.mote),
        surgeRemains: flagRemains(steps, index, (step) => step.surge),
        potmRemains: flagRemains(steps, index, (step) => step.why.includes('Power of the Maelstrom')),
        empoweredRemains: flagRemains(steps, index, (step) => step.why.includes('four-piece tier set')),
        swiftnessRemains: sittingRemains(steps, index),
        ascBuffRemains: flagRemains(steps, index, (step) => step.asc),
        ancestorRemains: flagRemains(steps, index, (step) => step.anc > 0),
        lvbCharges: lvb.charges,
        lvbChargeMax: LVB_CHARGES_MAX,
        lvbRecharge: lvb.rechargeRemains,
    }
}

const readCond = (id: CondId, board: TrainerBoard): boolean | null => {
    switch (id) {
        case 'sk_ready':
            return board.skReady
        case 'as_ready':
            return board.asReady
        case 'asc_ready':
            return board.ascReady
        case 'eb_ready':
            return board.ebReady
        case 'asc_cd_gt_10':
            return board.ascCd > 10
        case 'asc_cd_lt_gcd':
            return board.ascCd <= GCD
        case 'asc_cd_gt_5':
            return board.ascCd > 5
        case 'sk_cd_ge_15':
            return board.skCd >= 15
        case 'sk_stacks':
            return board.sk > 0
        case 'mote_up':
            return board.mote
        case 'mote_down':
            return !board.mote
        case 'fs_refresh':
            return board.fsRefresh
        case 'ms_afford_blast':
            return board.ms >= BLAST_COST
        case 'ms_near_cap':
            return board.ms >= CAP_WARN || board.deficit < 15
        case 'ms_room':
            return board.deficit > 15
        case 'surge':
            return board.surge
        case 'potm':
            return board.potm
        case 'empowered_4pc':
            return board.empowered4pc
        case 'swiftness_sitting':
            return board.swiftness
        case 'fight_dump':
            return board.fightRemains < 20
        case 'prepull':
            return board.prepull
        case 'lvb_charge':
            return board.lvbCharges > 0
    }
}

export const isCastLegal = (name: string, board: TrainerBoard): boolean => {
    if (name === 'lightning_bolt') return true
    if (name === 'lava_burst') return !board.mote && board.deficit > 15 && board.lvbCharges > 0
    if (name === 'elemental_blast') {
        const canPay = board.ms >= BLAST_COST || board.empowered4pc
        const reason = board.mote || board.ms >= CAP_WARN || board.deficit < 15 || board.empowered4pc
        return board.ebReady && canPay && reason
    }
    if (name === 'flame_shock') {
        if (!board.fsRefresh) return false
        return !board.mote ? board.ascCd > 5 : true
    }
    if (name === 'ancestral_swiftness') return board.asReady
    if (name === 'stormkeeper') {
        return (
            board.skReady &&
            (board.ascCd > 10 || board.ascCd <= GCD || board.prepull || board.fightRemains < 20)
        )
    }
    if (name === 'ascendance') {
        return board.ascReady && (board.sk > 0 || board.skCd >= 15 || board.fightRemains < 20)
    }
    return false
}

/** Lava Burst to apply MotE when the spender after it is already funded. Higher priorities stay in front. */
export const aplWantsLavaBurst = (board: TrainerBoard): boolean => {
    if (board.mote || board.lvbCharges < 1 || board.deficit <= 15) return false
    if (board.ms <= LVB_MS_FOR_SPENDER) return false
    if (
        board.skReady &&
        (board.ascCd > 10 || board.ascCd <= GCD || board.prepull || board.fightRemains < 20)
    ) {
        return false
    }
    if (board.asReady) return false
    if (board.fsRefresh && board.ascCd > 5) return false
    if (board.ascReady && (board.skCd >= 15 || board.fightRemains < 20)) return false
    return true
}

/** Sample cast, except a filler bolt the Midnight list would replace with Lava Burst. */
export const answerCast = (step: TrainerStep, board: TrainerBoard): string => {
    if (step.name === 'lightning_bolt' && aplWantsLavaBurst(board)) return 'lava_burst'
    return step.name
}

/** After an early Lava Burst, skip the sample's extra bolts and the burst it was delaying. */
export const indexAfterAnswer = (steps: TrainerStep[], index: number, cast: string): number => {
    const step = steps[index]
    if (!step || cast !== 'lava_burst' || step.name === 'lava_burst') return index + 1
    for (let j = index + 1; j < steps.length; j++) {
        if (steps[j].name === 'lava_burst') return j + 1
        if (steps[j].name !== 'lightning_bolt') return index + 1
    }
    return index + 1
}

export const getReaction = (board: TrainerBoard, castName = ''): { title: string; body: string } => {
    if (board.skReady) {
        if (!board.prepull && board.ascCd > 1 && board.ascCd <= 10) {
            return {
                title: 'Wait on Stormkeeper',
                body: `Ascendance is ${formatWowTimer(board.ascCd)} seconds away.`,
            }
        }
        return {
            title: 'Stormkeeper is available',
            body: 'Ascendance cooldown is more than 10 seconds.',
        }
    }
    if (board.asReady) {
        return {
            title: 'Ancestral Swiftness is available',
            body: 'Use it, then spend the instant on the next cast.',
        }
    }
    if (board.fsRefresh && !board.mote && board.ascCd > 5) {
        return { title: 'Flame Shock can be refreshed', body: `${MOTE_NAME} is down.` }
    }
    if (board.ascReady) {
        return {
            title: 'Ascendance is available',
            body:
                board.sk > 0 || board.skCd >= 15
                    ? 'Stormkeeper is already used, or still on a long cooldown.'
                    : 'Stormkeeper is almost ready. Wait.',
        }
    }
    if (board.sk > 0 && board.mote) {
        return {
            title: `Stormkeeper and ${MOTE_NAME} are both up`,
            body: holdLavaBurst(board, `Lightning Bolt spends ${MOTE_NAME} and a Stormkeeper stack.`),
        }
    }
    if (!board.mote) {
        if (castName === 'lava_burst') {
            return {
                title: `${MOTE_NAME} is down`,
                body: board.surge
                    ? 'Lava Surge is up. Lava Burst applies it.'
                    : board.ms > LVB_MS_FOR_SPENDER
                      ? 'Lava Burst applies it. Elemental Blast spends it next.'
                      : 'Lava Burst applies it.',
            }
        }
        return {
            title: `${MOTE_NAME} is down`,
            body:
                board.lvbCharges > 0
                    ? `Lava Burst has ${board.lvbCharges} of ${board.lvbChargeMax} charges. Press it when the second charge is about to finish, or when Maelstrom can pay a spender afterward. Lightning Bolt until then.`
                    : 'No Lava Burst charges. Lightning Bolt.',
        }
    }
    if (board.ebReady && (board.ms >= BLAST_COST || board.empowered4pc)) {
        return {
            title: `${MOTE_NAME} is up`,
            body: holdLavaBurst(board, 'Elemental Blast is off cooldown and you can pay for it.'),
        }
    }
    return {
        title: `${MOTE_NAME} is up`,
        body: holdLavaBurst(board, 'Elemental Blast if it is ready, otherwise Lightning Bolt.'),
    }
}

/** Appended while a charge is ready so the cue does not read as "press Lava Burst". */
const holdLavaBurst = (board: TrainerBoard, body: string): string =>
    board.lvbCharges > 0 ? `${body} Leave Lava Burst.` : body

/** Off cooldown and, for Elemental Blast, payable in Maelstrom or covered by the free-cast proc. */
export const isSpellEnabled = (name: string, board: TrainerBoard): boolean => {
    if (!spellCooldown(name, board).ready) return false
    if (name === 'elemental_blast') return board.ms >= BLAST_COST || board.empowered4pc
    return true
}

export const spellCooldown = (name: string, board: TrainerBoard): { remains: number; ready: boolean } => {
    if (name === 'stormkeeper') return { remains: board.skCd, ready: board.skReady }
    if (name === 'ancestral_swiftness') return { remains: board.asCd, ready: board.asReady }
    if (name === 'ascendance') return { remains: board.ascCd, ready: board.ascReady }
    if (name === 'elemental_blast') return { remains: board.ebCd, ready: board.ebReady }
    if (name === 'lava_burst') {
        return { remains: board.lvbCharges > 0 ? 0 : board.lvbRecharge, ready: board.lvbCharges > 0 }
    }
    return { remains: 0, ready: true }
}

export { readCond }
