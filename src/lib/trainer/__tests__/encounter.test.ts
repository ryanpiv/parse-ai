import { appliedDebuffs } from '../encounter'

describe('appliedDebuffs', () => {
    it('keeps a debuff only while time remains', () => {
        const shown = appliedDebuffs([
            {
                id: 'flame_shock',
                label: 'Flame Shock',
                icon: 'spell_fire_flameshock',
                spellId: 188389,
                remains: 12,
                stacks: null,
            },
            {
                id: 'expired',
                label: 'Expired',
                icon: 'spell_nature_lightningshield',
                remains: 0,
                stacks: null,
            },
        ])
        expect(shown.map((debuff) => debuff.id)).toEqual(['flame_shock'])
    })
})
