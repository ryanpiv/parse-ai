import { appliedDebuffs, type TrackedDebuff, type TrainerEncounter } from '../trainer/encounter'
import type { TrainerBoard } from './types'

/** Target debuffs this rotation cares about. Add the next one here when the board can time it. */
const moteTargetDebuffs = (board: TrainerBoard): TrackedDebuff[] => [
    {
        id: 'flame_shock',
        label: 'Flame Shock',
        icon: 'spell_fire_flameshock',
        spellId: 188389,
        remains: board.fsRemains,
        stacks: null,
    },
]

/** Single-target boss. Extra targets belong on `cleave` / `aoe` encounters later. */
export const buildMoteEncounter = (board: TrainerBoard): TrainerEncounter => {
    return {
        mode: 'single',
        targets: [{ id: 'boss', name: 'Boss', debuffs: appliedDebuffs(moteTargetDebuffs(board)) }],
    }
}
