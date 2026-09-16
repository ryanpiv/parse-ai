/**
 * @jest-environment jsdom
 */

import { writeWclUser } from '../../../../lib/wclUserToken'
import type { WclReportPage } from '../../../../lib/wclReports'
import {
    clearReportsBrowserCache,
    getCachedCurrentUser,
    getCachedFights,
    getCachedPlayers,
    getCachedReportPage,
    getReportsListKey,
    resetReportsBrowserSession,
    setCachedCurrentUser,
    setCachedFights,
    setCachedPlayers,
    setCachedReportPage,
} from '../reportsBrowserCache'

const samplePage: WclReportPage = {
    reports: [
        {
            code: 'Abc12',
            title: 'raid',
            startTime: 1,
            endTime: 2,
            zoneName: 'Zone',
            ownerName: 'Ryan',
        },
    ],
    page: 1,
    hasMore: false,
    total: 1,
}

describe('getReportsListKey', () => {
    it('keys my uploads by page', () => {
        expect(getReportsListKey({ kind: 'mine' }, 2)).toBe('mine:2')
    })

    it('keys a guild by id and page', () => {
        expect(getReportsListKey({ kind: 'guild', id: 9, label: 'Disappointed' }, 1)).toBe('guild:9:1')
    })
})

describe('reportsBrowserCache', () => {
    beforeEach(() => {
        resetReportsBrowserSession()
        localStorage.clear()
    })

    it('returns a stored report page until the cache is cleared', () => {
        setCachedReportPage('mine:1', samplePage)
        expect(getCachedReportPage('mine:1')).toEqual(samplePage)
        clearReportsBrowserCache()
        expect(getCachedReportPage('mine:1')).toBeNull()
    })

    it('stores fights and roster rows per report', () => {
        const fights = [
            {
                id: 3,
                name: 'Boss',
                difficulty: 5,
                kill: true,
                encounterID: 1,
                startTime: 0,
                endTime: 1000,
                fightPercentage: 0,
            },
        ]
        const players = [
            {
                id: 8,
                name: 'Mage',
                className: 'Mage',
                specLabel: 'Frost',
                role: 'dps' as const,
                iconUrl: null,
            },
        ]
        setCachedFights('Abc12', fights)
        setCachedPlayers('Abc12', 3, players)
        expect(getCachedFights('Abc12')).toEqual(fights)
        expect(getCachedPlayers('Abc12', 3)).toEqual(players)
        expect(getCachedPlayers('Abc12', 4)).toBeNull()
    })

    it('drops cached data when the signed-in name does not match', () => {
        writeWclUser({ token: 't', expiresAt: Date.now() + 60_000, userName: 'Bob' })
        setCachedReportPage('mine:1', samplePage)
        setCachedCurrentUser({ id: 1, name: 'Alice', guilds: [] })
        expect(getCachedCurrentUser()).toBeNull()
        expect(getCachedReportPage('mine:1')).toBeNull()
    })

    it('clears the session on sign-out and keeps it through token renewal', () => {
        setCachedReportPage('mine:1', samplePage)
        writeWclUser({ token: 't', expiresAt: Date.now() + 60_000, userName: 'Ryan' })
        expect(getCachedReportPage('mine:1')).toEqual(samplePage)

        writeWclUser(null)
        expect(getCachedReportPage('mine:1')).toBeNull()
        expect(getCachedCurrentUser()).toBeNull()
    })
})
