import { pickSimilarRank, wclCompareSearchLink, type WclTopRank } from '../../lib/wclReports'

function rank(rankNum: number, durationMs: number): WclTopRank {
    return {
        rank: rankNum,
        name: `Player${rankNum}`,
        serverName: 'Server',
        guildName: '',
        amount: 1_000_000 - rankNum,
        durationMs,
        reportCode: `code${rankNum}`,
        fightID: rankNum,
    }
}

describe('pickSimilarRank', () => {
    it('returns null for an empty list', () => {
        expect(pickSimilarRank([], 300_000)).toBeNull()
    })

    it('picks the highest-ranked parse within 10s of the pull', () => {
        const ranks = [rank(1, 200_000), rank(2, 295_000), rank(3, 301_000)]
        // #2 and #3 are both within 10s of 300s; #2 is ranked higher.
        expect(pickSimilarRank(ranks, 300_000)?.rank).toBe(2)
    })

    it('widens the tolerance when nothing is within 10s', () => {
        const ranks = [rank(1, 200_000), rank(2, 275_000)]
        // #2 is 25s off — found on the 30s pass; #1 (80s off) never qualifies.
        expect(pickSimilarRank(ranks, 300_000)?.rank).toBe(2)
    })

    it('falls back to the closest duration when nothing is within 60s', () => {
        const ranks = [rank(1, 100_000), rank(2, 180_000)]
        expect(pickSimilarRank(ranks, 300_000)?.rank).toBe(2)
    })
})

describe('wclCompareSearchLink', () => {
    it('links to the compare modal on the replay view of the exact pull', () => {
        expect(wclCompareSearchLink('AbC123', 8)).toBe(
            'https://www.warcraftlogs.com/reports/AbC123?fight=8&view=replay&modal=compare',
        )
    })
})
