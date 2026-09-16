/**
 * Per-player damage/healing/taken time series from WCL's `graph` endpoint —
 * the same pre-bucketed curves the WCL website charts, so it's one cheap
 * aliased query per report instead of streaming raw heal/taken events.
 * Feeds the metric-filtered timeline chart (MetricTimelineChart).
 */

export type MetricKey = 'dmg' | 'heal' | 'taken'

/** Points are [seconds since fight start, per-second value]. */
export type MetricPoints = Array<[number, number]>

export interface MetricSeries {
    dmg: MetricPoints
    heal: MetricPoints
    taken: MetricPoints
}

type GqlFn = (query: string, variables?: Record<string, unknown>) => Promise<unknown>

/**
 * WCL graph series come in two shapes depending on version: `data` as
 * [timestamp, value] pairs, or plain values with pointStart/pointInterval.
 */
function seriesPoints(series: any, fightStart: number): MetricPoints {
    const arr = Array.isArray(series?.data) ? series.data : []
    if (!arr.length) return []
    if (Array.isArray(arr[0])) {
        return arr.map(
            (p: any) => [(Number(p[0]) - fightStart) / 1000, Number(p[1]) || 0] as [number, number],
        )
    }
    const start = Number(series?.pointStart ?? fightStart)
    const interval = Number(series?.pointInterval ?? 1000)
    return arr.map(
        (v: any, i: number) =>
            [(start + i * interval - fightStart) / 1000, Number(v) || 0] as [number, number],
    )
}

function findPlayerSeries(graph: any, playerName: string, fightStart: number): MetricPoints {
    const list = graph?.data?.series
    if (!Array.isArray(list)) return []
    const wanted = playerName.toLowerCase()
    const match = list.find((s: any) => String(s?.name || '').toLowerCase() === wanted)
    return match ? seriesPoints(match, fightStart) : []
}

export async function fetchMetricGraphs(
    gql: GqlFn,
    code: string,
    fightStart: number,
    fightEnd: number,
    playerName: string,
): Promise<MetricSeries> {
    const data = await gql(
        `query($c:String!,$s:Float!,$e:Float!){
      reportData{ report(code:$c){
        dmg: graph(dataType: DamageDone, startTime:$s, endTime:$e)
        heal: graph(dataType: Healing, startTime:$s, endTime:$e)
        taken: graph(dataType: DamageTaken, startTime:$s, endTime:$e)
      } }
    }`,
        { c: code, s: fightStart, e: fightEnd },
    )
    const report = (data as any)?.reportData?.report
    return {
        dmg: findPlayerSeries(report?.dmg, playerName, fightStart),
        heal: findPlayerSeries(report?.heal, playerName, fightStart),
        taken: findPlayerSeries(report?.taken, playerName, fightStart),
    }
}
