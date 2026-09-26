import { formatWowTimer } from './board'
import type { TrainerBoard } from './types'
import type { ProcId } from './spells'

export type ProcHud = {
    id: ProcId
    active: boolean
    timer: string | null
    stacks: number | null
}

export const getProcHud = (board: TrainerBoard): ProcHud[] => {
    return [
        {
            id: 'surge',
            active: board.surge,
            timer: board.surgeRemains === null ? null : formatWowTimer(board.surgeRemains),
            stacks: null,
        },
        {
            id: 'mote',
            active: board.mote,
            timer: board.moteRemains === null ? null : formatWowTimer(board.moteRemains),
            stacks: null,
        },
        {
            id: 'sk_stacks',
            active: board.sk > 0,
            timer: null,
            stacks: board.sk > 0 ? board.sk : null,
        },
        {
            id: 'potm',
            active: board.potm,
            timer: board.potmRemains === null ? null : formatWowTimer(board.potmRemains),
            stacks: null,
        },
        {
            id: 'empowered_4pc',
            active: board.empowered4pc,
            timer: board.empoweredRemains === null ? null : formatWowTimer(board.empoweredRemains),
            stacks: null,
        },
        {
            id: 'swiftness',
            active: board.swiftness,
            timer: board.swiftnessRemains === null ? null : formatWowTimer(board.swiftnessRemains),
            stacks: null,
        },
        {
            id: 'asc_buff',
            active: board.ascUp,
            timer: board.ascBuffRemains === null ? null : formatWowTimer(board.ascBuffRemains),
            stacks: null,
        },
        {
            id: 'ancestors',
            active: board.anc > 0,
            timer: board.ancestorRemains === null ? null : formatWowTimer(board.ancestorRemains),
            stacks: board.anc > 0 ? board.anc : null,
        },
        {
            id: 'flame_shock_dot',
            active: board.fsRemains > 0 || board.fsRefresh,
            timer: board.fsRemains > 0 ? formatWowTimer(board.fsRemains) : board.fsRefresh ? '0' : null,
            stacks: null,
        },
    ]
}
