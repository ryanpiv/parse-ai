import { MOTE_NAME, SWIFTNESS_NAME, TIER_4PC_NAME } from './constants'

export type CastSpellId =
    | 'lightning_bolt'
    | 'lava_burst'
    | 'elemental_blast'
    | 'flame_shock'
    | 'ancestral_swiftness'
    | 'stormkeeper'
    | 'ascendance'

export type ProcId =
    | 'surge'
    | 'mote'
    | 'sk_stacks'
    | 'potm'
    | 'empowered_4pc'
    | 'swiftness'
    | 'asc_buff'
    | 'ancestors'
    | 'flame_shock_dot'

export type SpellBind = {
    key: '1' | '2' | '3' | '4' | '5'
    shift?: boolean
}

export type SpellIcon = {
    id: string
    label: string
    icon: string
    spellId?: number
    bind?: SpellBind
}

const ICON_ROOT = 'https://wow.zamimg.com/images/wow/icons/large'

export const iconUrl = (file: string): string => `${ICON_ROOT}/${file}.jpg`

export const formatBind = (bind: SpellBind): string => (bind.shift ? `⇧${bind.key}` : bind.key)

export const bindFromEvent = (event: KeyboardEvent): SpellBind | null => {
    const digit = event.code.match(/^Digit([1-5])$/)
    if (!digit) return null
    return { key: digit[1] as SpellBind['key'], shift: event.shiftKey }
}

export const sameBind = (left: SpellBind, right: SpellBind): boolean =>
    left.key === right.key && Boolean(left.shift) === Boolean(right.shift)

/** Row 1: spenders. Keys 1–5. */
export const SPENDER_SPELLS: SpellIcon[] = [
    {
        id: 'lightning_bolt',
        label: 'Lightning Bolt',
        icon: 'spell_nature_lightning',
        spellId: 188196,
        bind: { key: '1' },
    },
    {
        id: 'lava_burst',
        label: 'Lava Burst',
        icon: 'spell_shaman_lavaburst',
        spellId: 51505,
        bind: { key: '2' },
    },
    {
        id: 'elemental_blast',
        label: 'Elemental Blast',
        icon: 'shaman_talent_elementalblast',
        spellId: 117014,
        bind: { key: '3' },
    },
    {
        id: 'flame_shock',
        label: 'Flame Shock',
        icon: 'spell_fire_flameshock',
        spellId: 188389,
        bind: { key: '4' },
    },
]

/** Row 2: cooldowns. Shift+1–5. */
export const COOLDOWN_SPELLS: SpellIcon[] = [
    {
        id: 'ancestral_swiftness',
        label: 'Ancestral Swiftness',
        icon: 'inv_ability_farseershaman_ancestralswiftness',
        spellId: 443454,
        bind: { key: '1', shift: true },
    },
    {
        id: 'stormkeeper',
        label: 'Stormkeeper',
        icon: 'ability_thunderking_lightningwhip',
        spellId: 191634,
        bind: { key: '2', shift: true },
    },
    {
        id: 'ascendance',
        label: 'Ascendance',
        icon: '8026697',
        spellId: 114050,
        bind: { key: '3', shift: true },
    },
]

export const CAST_SPELLS: SpellIcon[] = [...SPENDER_SPELLS, ...COOLDOWN_SPELLS]

export const PROC_ICONS: SpellIcon[] = [
    { id: 'surge', label: 'Lava Surge', icon: 'spell_shaman_lavasurge', spellId: 77756 },
    { id: 'mote', label: MOTE_NAME, icon: 'spell_nature_elementalabsorption', spellId: 16166 },
    { id: 'sk_stacks', label: 'Stormkeeper', icon: 'ability_thunderking_lightningwhip', spellId: 191634 },
    { id: 'potm', label: 'Power of the Maelstrom', icon: 'spell_fire_masterofelements', spellId: 191861 },
    { id: 'empowered_4pc', label: TIER_4PC_NAME, icon: 'inv_chest_chain_07' },
    {
        id: 'swiftness',
        label: SWIFTNESS_NAME,
        icon: 'inv_ability_farseershaman_ancestralswiftness',
        spellId: 443454,
    },
    { id: 'asc_buff', label: 'Ascendance', icon: '8026697', spellId: 114050 },
    { id: 'ancestors', label: 'Ancestors', icon: 'ability_racial_ancestralcall', spellId: 443450 },
    { id: 'flame_shock_dot', label: 'Flame Shock', icon: 'spell_fire_flameshock', spellId: 188389 },
]
