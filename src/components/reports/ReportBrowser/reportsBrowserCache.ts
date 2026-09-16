/**
 * Tab-session cache for the Reports browser. Next unmounts the page on every
 * nav click; without this we re-spend WCL points on the same list. Cleared on
 * sign-out or explicit Refresh — not on remount.
 */
import { readWclUser, WCL_USER_CHANGED_EVENT } from '../../../lib/wclUserToken'
import type { FightPlayerRow } from '../../../lib/wclFightPlayers'
import type {
    WclCurrentUser,
    WclFightSummary,
    WclReportPage,
    WclReportSummary,
} from '../../../lib/wclReports'

export type ReportsSource = { kind: 'mine' } | { kind: 'guild'; id: number; label: string }

export interface IReportsBrowserMemory {
    source: ReportsSource
    page: number
    report: WclReportSummary | null
    fight: WclFightSummary | null
}

export const reportsBrowserMemory: IReportsBrowserMemory = {
    source: { kind: 'mine' },
    page: 1,
    report: null,
    fight: null,
}

let cachedMe: WclCurrentUser | null = null
const reportPages = new Map<string, WclReportPage>()
const fightsByCode = new Map<string, WclFightSummary[]>()
const playersByFight = new Map<string, FightPlayerRow[]>()

export function getReportsListKey(source: ReportsSource, page: number): string {
    return source.kind === 'mine' ? `mine:${page}` : `guild:${source.id}:${page}`
}

function getPlayersKey(reportCode: string, fightId: number): string {
    return `${reportCode}:${fightId}`
}

export function getCachedCurrentUser(): WclCurrentUser | null {
    if (!cachedMe) return null
    const signedIn = typeof window !== 'undefined' ? readWclUser() : null
    if (signedIn?.userName && cachedMe.name && signedIn.userName !== cachedMe.name) {
        resetReportsBrowserSession()
        return null
    }
    return cachedMe
}

export function setCachedCurrentUser(me: WclCurrentUser | null): void {
    cachedMe = me
}

export function getCachedReportPage(key: string): WclReportPage | null {
    return reportPages.get(key) ?? null
}

export function setCachedReportPage(key: string, page: WclReportPage): void {
    reportPages.set(key, page)
}

export function getCachedFights(reportCode: string): WclFightSummary[] | null {
    return fightsByCode.get(reportCode) ?? null
}

export function setCachedFights(reportCode: string, fights: WclFightSummary[]): void {
    fightsByCode.set(reportCode, fights)
}

export function getCachedPlayers(reportCode: string, fightId: number): FightPlayerRow[] | null {
    return playersByFight.get(getPlayersKey(reportCode, fightId)) ?? null
}

export function setCachedPlayers(reportCode: string, fightId: number, rows: FightPlayerRow[]): void {
    playersByFight.set(getPlayersKey(reportCode, fightId), rows)
}

export function clearReportsBrowserCache(): void {
    cachedMe = null
    reportPages.clear()
    fightsByCode.clear()
    playersByFight.clear()
}

export function resetReportsBrowserSession(): void {
    reportsBrowserMemory.source = { kind: 'mine' }
    reportsBrowserMemory.page = 1
    reportsBrowserMemory.report = null
    reportsBrowserMemory.fight = null
    clearReportsBrowserCache()
}

function handleWclUserChanged() {
    if (!readWclUser()) resetReportsBrowserSession()
}

if (typeof window !== 'undefined') {
    window.addEventListener(WCL_USER_CHANGED_EVENT, handleWclUserChanged)
}
