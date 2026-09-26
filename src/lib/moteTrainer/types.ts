export type TrainerStep = {
    t: number
    name: string
    label: string
    ms: number
    dur: number
    sk: number
    mote: boolean
    anc: number
    asc: boolean
    surge: boolean
    phase: string
    why: string
}

export type CondId =
    | 'sk_ready'
    | 'as_ready'
    | 'asc_ready'
    | 'eb_ready'
    | 'asc_cd_gt_10'
    | 'asc_cd_lt_gcd'
    | 'asc_cd_gt_5'
    | 'sk_cd_ge_15'
    | 'sk_stacks'
    | 'mote_up'
    | 'mote_down'
    | 'fs_refresh'
    | 'ms_afford_blast'
    | 'ms_near_cap'
    | 'ms_room'
    | 'surge'
    | 'potm'
    | 'empowered_4pc'
    | 'swiftness_sitting'
    | 'fight_dump'
    | 'prepull'
    | 'lvb_charge'

export type TrainerBoard = {
    ms: number
    deficit: number
    mote: boolean
    surge: boolean
    sk: number
    anc: number
    ascUp: boolean
    skCd: number
    asCd: number
    ascCd: number
    ebCd: number
    skReady: boolean
    asReady: boolean
    ascReady: boolean
    ebReady: boolean
    fsRefresh: boolean
    fsAge: number | null
    fsRemains: number
    potm: boolean
    empowered4pc: boolean
    swiftness: boolean
    fightRemains: number
    prepull: boolean
    phase: string
    moteRemains: number | null
    surgeRemains: number | null
    potmRemains: number | null
    empoweredRemains: number | null
    swiftnessRemains: number | null
    ascBuffRemains: number | null
    ancestorRemains: number | null
    lvbCharges: number
    lvbChargeMax: number
    lvbRecharge: number
}
