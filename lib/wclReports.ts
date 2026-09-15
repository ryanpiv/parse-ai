/**
 * Report-browsing queries for the signed-in WCL user: who am I, which reports
 * can I see (my uploads / my guilds' logs), and which boss pulls are in a
 * report. Runs in the browser through /api/wcl with the user's own token, so
 * results follow the user's WCL permissions (private logs included).
 */
import type { WclGqlFn } from './talents/fetchTalents'

export interface WclGuildRef {
  id: number
  name: string
  serverName: string
}

export interface WclCurrentUser {
  id: number
  name: string
  guilds: WclGuildRef[]
}

export async function fetchCurrentUser(gql: WclGqlFn): Promise<WclCurrentUser | null> {
  const data = await gql(
    `{ userData { currentUser { id name guilds { id name server { name } } } } }`,
    {}
  )
  const u = (data as any)?.userData?.currentUser
  if (!u?.id) return null
  return {
    id: Number(u.id),
    name: String(u.name || ''),
    guilds: (Array.isArray(u.guilds) ? u.guilds : [])
      .filter((g: any) => Number.isFinite(Number(g?.id)))
      .map((g: any) => ({
        id: Number(g.id),
        name: String(g.name || 'Unknown guild'),
        serverName: String(g?.server?.name || ''),
      })),
  }
}

export interface WclReportSummary {
  code: string
  title: string
  startTime: number
  endTime: number
  zoneName: string
  ownerName: string
}

export interface WclReportPage {
  reports: WclReportSummary[]
  page: number
  hasMore: boolean
  total: number
}

export const REPORTS_PER_PAGE = 20

/** One page of reports — pass exactly one of userID (my uploads) or guildID. */
export async function fetchReportPage(
  gql: WclGqlFn,
  opts: { userID?: number; guildID?: number; page: number }
): Promise<WclReportPage> {
  const data = await gql(
    `query($userID: Int, $guildID: Int, $page: Int!, $limit: Int!) {
      reportData {
        reports(userID: $userID, guildID: $guildID, page: $page, limit: $limit) {
          total current_page has_more_pages
          data { code title startTime endTime zone { name } owner { name } }
        }
      }
    }`,
    {
      userID: opts.userID ?? null,
      guildID: opts.guildID ?? null,
      page: opts.page,
      limit: REPORTS_PER_PAGE,
    }
  )
  const pg = (data as any)?.reportData?.reports
  return {
    reports: (Array.isArray(pg?.data) ? pg.data : [])
      .filter((r: any) => typeof r?.code === 'string' && r.code)
      .map((r: any) => ({
        code: String(r.code),
        title: String(r.title || 'Untitled report'),
        startTime: Number(r.startTime || 0),
        endTime: Number(r.endTime || 0),
        zoneName: String(r?.zone?.name || ''),
        ownerName: String(r?.owner?.name || ''),
      })),
    page: Number(pg?.current_page || opts.page),
    hasMore: Boolean(pg?.has_more_pages),
    total: Number(pg?.total || 0),
  }
}

export interface WclFightSummary {
  id: number
  name: string
  /** WCL difficulty id (3 Normal, 4 Heroic, 5 Mythic, …); null for trash/unknown. */
  difficulty: number | null
  kill: boolean
  encounterID: number
  startTime: number
  endTime: number
  /** Boss HP % remaining on a wipe (0 on kills). */
  fightPercentage: number | null
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'LFR',
  3: 'Normal',
  4: 'Heroic',
  5: 'Mythic',
  8: 'M+',
}

export function difficultyLabel(difficulty: number | null): string {
  return difficulty != null ? DIFFICULTY_LABELS[difficulty] ?? '' : ''
}

/** Boss pulls in a report (encounterID > 0 — trash fights are skipped). */
export async function fetchReportFights(
  gql: WclGqlFn,
  code: string
): Promise<{ title: string; fights: WclFightSummary[] }> {
  const data = await gql(
    `query($c: String!) {
      reportData { report(code: $c) {
        title
        fights { id name difficulty kill encounterID startTime endTime fightPercentage }
      } }
    }`,
    { c: code }
  )
  const report = (data as any)?.reportData?.report
  if (!report) throw new Error('Report not found or inaccessible.')
  const fights: WclFightSummary[] = (Array.isArray(report.fights) ? report.fights : [])
    .filter((f: any) => Number(f?.encounterID) > 0)
    .map((f: any) => ({
      id: Number(f.id),
      name: String(f.name || `Fight ${f.id}`),
      difficulty: f.difficulty != null ? Number(f.difficulty) : null,
      kill: f.kill === true,
      encounterID: Number(f.encounterID),
      startTime: Number(f.startTime || 0),
      endTime: Number(f.endTime || 0),
      fightPercentage: f.fightPercentage != null ? Number(f.fightPercentage) : null,
    }))
  return { title: String(report.title || 'Untitled report'), fights }
}

export interface WclTopRank {
  rank: number
  name: string
  serverName: string
  guildName: string
  /** Metric total (dps/hps) for the ranked pull. */
  amount: number
  durationMs: number
  reportCode: string
  fightID: number
}

/** Cache per encounter+spec+difficulty — rankings queries are point-expensive on WCL. */
const ranksCache = new Map<string, WclTopRank[]>()

/**
 * Top ranked parses for an encounter, filtered to one class/spec/difficulty.
 * Powers "compare vs a top parse": each row carries its own report + fight id,
 * so a cross-report compare URL can be built from it.
 */
export async function fetchEncounterTopRanks(
  gql: WclGqlFn,
  opts: {
    encounterID: number
    className: string
    specName: string
    difficulty: number | null
    metric: 'dps' | 'hps'
  }
): Promise<WclTopRank[]> {
  const key = `${opts.encounterID}:${opts.className}:${opts.specName}:${opts.difficulty}:${opts.metric}`
  const cached = ranksCache.get(key)
  if (cached) return cached

  const data = await gql(
    `query($id: Int!, $className: String!, $specName: String!, $difficulty: Int, $metric: CharacterRankingMetricType) {
      worldData { encounter(id: $id) {
        characterRankings(className: $className, specName: $specName, difficulty: $difficulty, metric: $metric, page: 1)
      } }
    }`,
    {
      id: opts.encounterID,
      className: opts.className.replace(/[^a-zA-Z]/g, ''),
      specName: opts.specName.replace(/[^a-zA-Z]/g, ''),
      difficulty: opts.difficulty,
      metric: opts.metric,
    }
  )
  const blob = (data as any)?.worldData?.encounter?.characterRankings
  const rows: WclTopRank[] = (Array.isArray(blob?.rankings) ? blob.rankings : [])
    .filter((r: any) => typeof r?.report?.code === 'string' && r.report.code)
    .map((r: any, i: number) => ({
      rank: i + 1,
      name: String(r.name || 'Unknown'),
      serverName: String(r?.server?.name || ''),
      guildName: String(r?.guild?.name || ''),
      amount: Number(r.amount || 0),
      durationMs: Number(r.duration || 0),
      reportCode: String(r.report.code),
      fightID: Number(r.report.fightID),
    }))
  ranksCache.set(key, rows)
  return rows
}

/** Cross-report compare URL: my pull vs a ranked player's pull (I am player 1). */
export function buildCrossReportCompareUrl(
  myCode: string,
  myFightId: number,
  myPlayerId: number,
  theirCode: string,
  theirFightId: number,
  theirName: string
): string {
  return `https://www.warcraftlogs.com/reports/compare/${myCode}/${theirCode}?fight=${myFightId},${theirFightId}&source=${myPlayerId},${encodeURIComponent(theirName)}`
}

/** Solo analyze URL in the exact shape `parseWclUrl` accepts. */
export function buildSoloUrl(code: string, fightId: number, playerId: number): string {
  return `https://www.warcraftlogs.com/reports/${code}?fight=${fightId}&source=${playerId}`
}

/** Same-report compare URL (player 1 = first argument). */
export function buildCompareUrl(code: string, fightId: number, p1: number, p2: number): string {
  return `https://www.warcraftlogs.com/reports/compare/${code}/${code}?fight=${fightId},${fightId}&source=${p1},${p2}`
}

/** Deep link to the report (and optionally a fight) on warcraftlogs.com. */
export function wclReportLink(code: string, fightId?: number): string {
  return fightId != null
    ? `https://www.warcraftlogs.com/reports/${code}?fight=${fightId}`
    : `https://www.warcraftlogs.com/reports/${code}`
}

/**
 * WCL's "find similar parses" compare modal for this exact pull — the
 * "more options" escape hatch (fight length / raid size / ilvl / time-range
 * knobs live there, not in the v2 API).
 */
export function wclCompareSearchLink(code: string, fightId: number): string {
  return `https://www.warcraftlogs.com/reports/${code}?fight=${fightId}&view=replay&modal=compare`
}

/**
 * Pick the best "similar" parse from a rank-ordered list: the highest-ranked
 * entry whose kill time is close to the player's pull (widening 10s → 30s →
 * 60s, mirroring WCL's own fight-length-based similar search), falling back to
 * the closest duration overall. The v2 API has no similar-parse search, so
 * this approximates it over the top-ranked page.
 */
export function pickSimilarRank(ranks: WclTopRank[], myDurationMs: number): WclTopRank | null {
  if (!ranks.length) return null
  for (const tolerance of [10_000, 30_000, 60_000]) {
    const hit = ranks.find(r => Math.abs(r.durationMs - myDurationMs) <= tolerance)
    if (hit) return hit
  }
  return [...ranks].sort(
    (a, b) => Math.abs(a.durationMs - myDurationMs) - Math.abs(b.durationMs - myDurationMs)
  )[0]
}
