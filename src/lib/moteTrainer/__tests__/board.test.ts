/**
 * @jest-environment jsdom
 */

import {
    answerCast,
    buildBoard,
    formatWowTimer,
    getReaction,
    indexAfterAnswer,
    inferLvbCharges,
    isCastLegal,
    isSpellEnabled,
} from '../board'
import { buildMoteEncounter } from '../encounter'
import { BLAST_COST, LVB_CHARGES_MAX, MOTE_NAME, MS_MAX } from '../constants'
import { TRAINER_STEPS } from '../steps'
import type { TrainerStep } from '../types'

const step = (partial: Partial<TrainerStep> & Pick<TrainerStep, 't' | 'name'>): TrainerStep => ({
    label: partial.name,
    ms: 0,
    dur: 1.0,
    sk: 0,
    mote: false,
    anc: 0,
    asc: false,
    surge: false,
    phase: 'Test',
    why: '',
    ...partial,
})

describe('buildBoard', () => {
    it('marks stormkeeper ready on the prepull gcd', () => {
        const board = buildBoard(TRAINER_STEPS, 0)
        expect(board.skReady).toBe(true)
        expect(board.prepull).toBe(true)
        expect(isCastLegal('stormkeeper', board)).toBe(true)
        expect(getReaction(board).title).toBe('Stormkeeper is available')
        expect(board.ebReady).toBe(true)
        expect(board.lvbCharges).toBe(LVB_CHARGES_MAX)
    })

    it('shows two lava burst charges before the first spend', () => {
        expect(inferLvbCharges(TRAINER_STEPS, 0).charges).toBe(2)
    })

    it('drops a lava burst charge after the first spend', () => {
        const afterFirst = TRAINER_STEPS.findIndex((s) => s.name === 'lava_burst')
        expect(inferLvbCharges(TRAINER_STEPS, afterFirst).charges).toBe(2)
        expect(inferLvbCharges(TRAINER_STEPS, afterFirst + 1).charges).toBe(1)
    })

    it('describes stormkeeper and mote in plain language', () => {
        const board = buildBoard(
            [
                step({ t: -20, name: 'ancestral_swiftness' }),
                step({ t: -10, name: 'ascendance' }),
                step({ t: -1.2, name: 'stormkeeper' }),
                step({ t: 0, name: 'lightning_bolt', sk: 2, mote: true, ms: 40 }),
            ],
            3,
        )
        expect(getReaction(board, 'lightning_bolt')).toEqual({
            title: `Stormkeeper and ${MOTE_NAME} are both up`,
            body: `Lightning Bolt spends ${MOTE_NAME} and a Stormkeeper stack. Leave Lava Burst.`,
        })
    })

    it('leaves a ready lava burst charge on a filler bolt', () => {
        const index = TRAINER_STEPS.findIndex((entry) => entry.t === 8.4)
        const board = buildBoard(TRAINER_STEPS, index)
        expect(board.lvbCharges).toBe(1)
        expect(getReaction(board, 'lightning_bolt')).toEqual({
            title: `${MOTE_NAME} is down`,
            body: 'Lava Burst has 1 of 2 charges. Press it when the second charge is about to finish, or when Maelstrom can pay a spender afterward. Lightning Bolt until then.',
        })
    })

    it('does not show two lava burst charges on a filler bolt', () => {
        const index = TRAINER_STEPS.findIndex((entry) => entry.t === 20.9)
        const board = buildBoard(TRAINER_STEPS, index)
        expect(TRAINER_STEPS[index].name).toBe('lightning_bolt')
        expect(board.lvbCharges).toBe(1)
    })

    it('presses lava burst at 77 maelstrom so elemental blast can spend mote', () => {
        const index = TRAINER_STEPS.findIndex((entry) => entry.t === 9.8)
        const board = buildBoard(TRAINER_STEPS, index)
        expect(TRAINER_STEPS[index].name).toBe('lightning_bolt')
        expect(answerCast(TRAINER_STEPS[index], board)).toBe('lava_burst')
        expect(getReaction(board, 'lava_burst').body).toBe(
            'Lava Burst applies it. Elemental Blast spends it next.',
        )
        expect(indexAfterAnswer(TRAINER_STEPS, index, 'lava_burst')).toBe(
            TRAINER_STEPS.findIndex((entry) => entry.t === 12.7),
        )
    })

    it('keeps a lightning bolt while maelstrom cannot fund the spender after lava burst', () => {
        const index = TRAINER_STEPS.findIndex((entry) => entry.t === 8.4)
        const board = buildBoard(TRAINER_STEPS, index)
        expect(answerCast(TRAINER_STEPS[index], board)).toBe('lightning_bolt')
    })

    it('says lava burst applies mote when that cast is next', () => {
        const index = TRAINER_STEPS.findIndex((entry) => entry.t === 2)
        expect(getReaction(buildBoard(TRAINER_STEPS, index), 'lava_burst').body).toBe(
            'Lava Burst applies it.',
        )
    })

    it('tracks maelstrom deficit from the current step', () => {
        const board = buildBoard(
            [step({ t: 0, name: 'lightning_bolt', ms: 80 }), step({ t: 1.4, name: 'lava_burst', ms: 90 })],
            0,
        )
        expect(board.ms).toBe(80)
        expect(board.deficit).toBe(MS_MAX - 80)
        expect(board.ms >= BLAST_COST).toBe(true)
    })
})

describe('buildBoard flags from why text', () => {
    it('still reads flame shock, four-piece, potm, and swiftness from the rewritten steps', () => {
        const indexOf = (t: number) => TRAINER_STEPS.findIndex((s) => s.t === t)
        expect(buildBoard(TRAINER_STEPS, indexOf(34.1)).fsRefresh).toBe(true)
        expect(buildBoard(TRAINER_STEPS, indexOf(23.7)).empowered4pc).toBe(true)
        expect(buildBoard(TRAINER_STEPS, indexOf(11.2)).potm).toBe(true)
        expect(buildBoard(TRAINER_STEPS, indexOf(45.8)).swiftness).toBe(true)
        expect(buildBoard(TRAINER_STEPS, indexOf(46.8)).swiftness).toBe(false)
    })
})

describe('isSpellEnabled', () => {
    it('greys elemental blast when maelstrom cannot pay and no free proc is up', () => {
        const board = buildBoard([step({ t: 0, name: 'lightning_bolt', ms: 40 })], 0)
        expect(isSpellEnabled('elemental_blast', board)).toBe(false)
        expect(isSpellEnabled('lightning_bolt', board)).toBe(true)
    })

    it('enables elemental blast at the maelstrom cost', () => {
        const board = buildBoard([step({ t: 0, name: 'elemental_blast', ms: BLAST_COST })], 0)
        expect(isSpellEnabled('elemental_blast', board)).toBe(true)
    })

    it('enables elemental blast when the four-piece proc makes it free', () => {
        const board = buildBoard(
            [step({ t: 0, name: 'lightning_bolt', ms: 10, why: 'The four-piece tier set is active.' })],
            0,
        )
        expect(isSpellEnabled('elemental_blast', board)).toBe(true)
    })
})

describe('buildMoteEncounter', () => {
    it('puts flame shock on the single boss after ascendance applies it', () => {
        const index = TRAINER_STEPS.findIndex((step) => step.t === 2)
        const encounter = buildMoteEncounter(buildBoard(TRAINER_STEPS, index))
        expect(encounter.mode).toBe('single')
        expect(encounter.targets).toHaveLength(1)
        expect(encounter.targets[0].debuffs.map((debuff) => debuff.id)).toEqual(['flame_shock'])
        expect(encounter.targets[0].debuffs[0].remains).toBeGreaterThan(0)
    })

    it('leaves the boss plate empty before flame shock is applied', () => {
        const encounter = buildMoteEncounter(buildBoard(TRAINER_STEPS, 0))
        expect(encounter.targets[0].debuffs).toEqual([])
    })
})

describe('isCastLegal', () => {
    it('blocks burst when master of the elements is up', () => {
        const board = buildBoard([step({ t: 0, name: 'lightning_bolt', mote: true, ms: 40 })], 0)
        expect(isCastLegal('lava_burst', board)).toBe(false)
        expect(isCastLegal('lightning_bolt', board)).toBe(true)
    })

    it('allows burst when mote is down and there is room to generate', () => {
        const board = buildBoard([step({ t: 0, name: 'lava_burst', mote: false, ms: 40 })], 0)
        expect(isCastLegal('lava_burst', board)).toBe(true)
    })
})

describe('formatWowTimer', () => {
    it('uses a whole second at ten or above', () => {
        expect(formatWowTimer(12.4)).toBe('12')
    })

    it('keeps one decimal under ten', () => {
        expect(formatWowTimer(4.2)).toBe('4.2')
    })
})
