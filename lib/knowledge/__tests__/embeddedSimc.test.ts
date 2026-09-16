import {
    SIMC_BUNDLE_BY_SPEC_ID,
    simcAplAvailableForSpec,
    getSimcAplSupplement,
} from '../embeddedSimc'

/** Every Midnight spec with an upstream default APL (34 of 40). */
const SPEC_IDS_WITH_APL = [
    62,
    63,
    64, // Mage
    66,
    70, // Paladin (no Holy)
    71,
    72,
    73, // Warrior
    102,
    103,
    104,
    105, // Druid (Resto has a DPS APL upstream)
    250,
    251,
    252, // Death Knight
    253,
    254,
    255, // Hunter
    258, // Priest (Shadow only)
    259,
    260,
    261, // Rogue
    262,
    263, // Shaman (no Resto)
    265,
    266,
    267, // Warlock
    268,
    269, // Monk (no Mistweaver)
    577,
    581,
    1480, // Demon Hunter (incl. Midnight's Devourer)
    1467,
    1473, // Evoker (no Preservation)
]

/** Healers SimC does not sim — must stay unavailable. */
const SPEC_IDS_WITHOUT_APL = [65, 256, 257, 264, 270, 1468]

describe('embeddedSimc', () => {
    it('covers all 34 specs with an upstream default APL', () => {
        expect(SPEC_IDS_WITH_APL).toHaveLength(34)
        for (const id of SPEC_IDS_WITH_APL) {
            expect(simcAplAvailableForSpec(id)).toBe(true)
        }
        expect(Object.keys(SIMC_BUNDLE_BY_SPEC_ID)).toHaveLength(SPEC_IDS_WITH_APL.length)
    })

    it('reports healer specs without an upstream APL as unavailable', () => {
        for (const id of SPEC_IDS_WITHOUT_APL) {
            expect(simcAplAvailableForSpec(id)).toBe(false)
            expect(getSimcAplSupplement(id, true)).toBe('')
        }
    })

    it('returns a non-empty grounded supplement with APL text for every covered spec', () => {
        for (const id of SPEC_IDS_WITH_APL) {
            const text = getSimcAplSupplement(id, true, 'Testchar')
            expect(text).toContain('<simc_apl>')
            expect(text).toContain('actions')
            expect(text).toContain(SIMC_BUNDLE_BY_SPEC_ID[id].displayName)
        }
    })

    it('returns empty when not grounded (opt-in only)', () => {
        expect(getSimcAplSupplement(64, false)).toBe('')
    })
})
