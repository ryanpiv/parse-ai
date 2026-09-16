import {
    getWowheadReferenceSupplement,
    wowheadReferenceAvailableForSpec,
} from '../../lib/knowledge/embeddedWowhead'

/** All 40 retail (Midnight) ChrSpecialization ids the corpus must cover. */
const ALL_SPEC_IDS = [
    62,
    63,
    64, // Mage
    65,
    66,
    70, // Paladin
    71,
    72,
    73, // Warrior
    102,
    103,
    104,
    105, // Druid
    250,
    251,
    252, // Death Knight
    253,
    254,
    255, // Hunter
    256,
    257,
    258, // Priest
    259,
    260,
    261, // Rogue
    262,
    263,
    264, // Shaman
    265,
    266,
    267, // Warlock
    268,
    269,
    270, // Monk
    577,
    581,
    1480, // Demon Hunter (incl. Midnight's Devourer)
    1467,
    1468,
    1473, // Evoker
]

describe('embeddedWowhead corpus', () => {
    it('covers every retail spec', () => {
        for (const id of ALL_SPEC_IDS) {
            expect(wowheadReferenceAvailableForSpec(id)).toBe(true)
        }
        expect(ALL_SPEC_IDS).toHaveLength(40)
    })

    it('is unavailable for unknown or missing spec ids', () => {
        expect(wowheadReferenceAvailableForSpec(999999)).toBe(false)
        expect(wowheadReferenceAvailableForSpec(null)).toBe(false)
        expect(wowheadReferenceAvailableForSpec(undefined)).toBe(false)
    })

    it('builds a non-empty supplement with talent and rotation blocks for each spec', () => {
        for (const id of ALL_SPEC_IDS) {
            const text = getWowheadReferenceSupplement(id, true, 'Tester', 'compare')
            expect(text).toContain('wowhead_reference')
            expect(text).toContain('talent import table')
            expect(text).toContain('rotation guide')
        }
    })

    it('returns nothing when not grounded', () => {
        expect(getWowheadReferenceSupplement(64, false, 'Tester', 'compare')).toBe('')
    })
})
