/**
 * One-off probe: buff snapshot at pull (t=0) and t=1s with vs without pre-pull WCL window.
 * Usage: node scripts/wcl-prepull-buff-probe.mjs [reportCode] [fightId]
 * Example: node scripts/wcl-prepull-buff-probe.mjs GQRMmXkqrB3AJYd8 12 600000
 */
import fs from 'fs'
import path from 'path'

const WCL_ENDPOINT = 'https://www.warcraftlogs.com/api/v2/client'

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  const text = fs.readFileSync(p, 'utf8')
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function token() {
  return (
    process.env.WCL_TOKEN?.trim() ||
    process.env.WCL_TOKEN_LOCAL?.trim() ||
    process.env.WARCRAFTLOGS_TOKEN?.trim() ||
    ''
  )
}

async function gql(tok, query, variables) {
  const r = await fetch(WCL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const text = await r.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`WCL non-JSON ${r.status}: ${text.slice(0, 500)}`)
  }
  if (json.errors?.length) {
    throw new Error(JSON.stringify(json.errors, null, 2))
  }
  return json.data
}

/** Replay buff+debuff events (same rules as lib/gameState/tracking.ts) */
function buildStateTracker(buffEvents, debuffEvents, fightStartMs) {
  const buffWindows = {}
  const activeAtTime = {}

  const allEvents = [
    ...buffEvents.map((e) => ({ ...e, _type: 'buff' })),
    ...debuffEvents.map((e) => ({ ...e, _type: 'debuff' })),
  ].sort((a, b) => a.timestamp - b.timestamp)

  for (const ev of allEvents) {
    const id = ev.abilityGameID
    const t = (ev.timestamp - fightStartMs) / 1000
    const type = ev.type
    if (!buffWindows[id]) buffWindows[id] = []

    if (type === 'applybuff' || type === 'applydebuff') {
      activeAtTime[id] = { start: t, stacks: 1 }
    } else if (type === 'applybuffstack' || type === 'applydebuffstack') {
      if (activeAtTime[id]) {
        activeAtTime[id].stacks = ev.stack || activeAtTime[id].stacks + 1
      } else {
        activeAtTime[id] = { start: t, stacks: ev.stack || 1 }
      }
    } else if (type === 'removebuffstack' || type === 'removedebuffstack') {
      if (activeAtTime[id]) {
        activeAtTime[id].stacks = ev.stack || Math.max(0, activeAtTime[id].stacks - 1)
      }
    } else if (type === 'removebuff' || type === 'removedebuff') {
      if (activeAtTime[id]) {
        buffWindows[id].push({
          start: activeAtTime[id].start,
          end: t,
          stacks: activeAtTime[id].stacks,
        })
        delete activeAtTime[id]
      }
    }
  }

  for (const [id, state] of Object.entries(activeAtTime)) {
    const numId = Number(id)
    if (!buffWindows[numId]) buffWindows[numId] = []
    buffWindows[numId].push({ start: state.start, end: 999999, stacks: state.stacks })
  }

  function getStateAt(sec) {
    const active = {}
    for (const [id, windows] of Object.entries(buffWindows)) {
      for (const w of windows) {
        if (sec >= w.start && sec <= w.end) {
          active[Number(id)] = w.stacks
          break
        }
      }
    }
    return active
  }

  return { getStateAt, buffWindows }
}

function stateToLines(active, nameById) {
  return Object.entries(active)
    .map(([id, stacks]) => {
      const n = nameById[Number(id)] || `spell ${id}`
      return `  ${id}  ${stacks}x  ${n}`
    })
    .sort((a, b) => a.localeCompare(b))
}

const REPORT = process.argv[2] || 'GQRMmXkqrB3AJYd8'
const FIGHT_ID = Number(process.argv[3] || '12')
const LOOKBACK_MS = Number(process.argv[4] || 600_000)


loadEnvLocal()
const tok = token()
if (!tok) {
  console.error('No WCL_TOKEN in env or .env.local')
  process.exit(1)
}

const reportQ = `
query($c:String!){
  reportData{
    report(code:$c){
      title
      fights{id name startTime endTime kill}
      masterData{actors{id name type subType}}
    }
  }
}`

const data = await gql(tok, reportQ, { c: REPORT })
const report = data?.reportData?.report
if (!report) {
  console.error('No report', data)
  process.exit(1)
}

const fight = report.fights?.find((f) => f.id === FIGHT_ID)
if (!fight) {
  console.error(
    'Fight not found. IDs:',
    report.fights?.map((f) => f.id)
  )
  process.exit(1)
}

const { startTime: fightStart, endTime: fightEnd, name: fightName } = fight
console.log('Report:', report.title, '| Fight:', fightName, `id=${FIGHT_ID}`)
console.log('Window ms:', fightStart, '→', fightEnd, `(${(fightEnd - fightStart) / 1000}s)`)

const pdQ = `
query($code:String!,$fightId:Int!){
  reportData{report(code:$code){playerDetails(fightIDs:[$fightId])}}
}`

const pd = await gql(tok, pdQ, { code: REPORT, fightId: FIGHT_ID })
const rawPd = pd?.reportData?.report?.playerDetails
const details = rawPd?.data ?? rawPd
let dps = details?.dps || []

if (!dps.length) {
  const [meta, dmg] = await Promise.all([
    gql(tok, `query($c:String!){reportData{report(code:$c){masterData{actors{id name type subType}}}}}`, {
      c: REPORT,
    }),
    gql(
      tok,
      `query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`,
      { c: REPORT, s: fightStart, e: fightEnd }
    ),
  ])
  const actors = meta?.reportData?.report?.masterData?.actors?.filter((a) => a.type === 'Player') || []
  const byLowerName = new Map(actors.map((a) => [String(a.name || '').trim().toLowerCase(), a]))
  const dmgEntries = dmg?.reportData?.report?.table?.data?.entries || []
  for (const e of dmgEntries) {
    const name = String(e?.name || '').trim()
    if (!name) continue
    const entryType = String(e?.type || '')
    if (entryType === 'Pet' || entryType === 'Summon') continue
    const actor = byLowerName.get(name.toLowerCase())
    if (!actor) continue
    const id = Number(actor.id)
    if (!Number.isFinite(id)) continue
    dps.push({ id, name: String(actor.name || name) })
    if (dps.length >= 2) break
  }
}

const pick = dps.slice(0, 2)
if (!pick.length) {
  console.error('No DPS in playerDetails; extend script for ranking fallback')
  process.exit(1)
}

async function fetchBuffs(startMs, endMs, targetId) {
  const q = `query($c:String!,$s:Float!,$e:Float!,$tgt:Int!){
    reportData{report(code:$c){events(dataType:Buffs,startTime:$s,endTime:$e,targetID:$tgt,limit:10000){data}}}
  }`
  const d = await gql(tok, q, { c: REPORT, s: startMs, e: endMs, tgt: targetId })
  return d?.reportData?.report?.events?.data || []
}

const nameById = {}
for (const a of report.masterData?.actors || []) {
  if (a.id && a.name) nameById[a.id] = a.name
}

for (const player of pick) {
  const pid = player.id
  const pname = player.name
  console.log('\n========', pname, `(targetID ${pid})`, '========')

  const inFightOnly = await fetchBuffs(fightStart, fightEnd, pid)
  const withLookback = await fetchBuffs(fightStart - LOOKBACK_MS, fightEnd, pid)

  console.log(`Buff event count: in-fight-only ${inFightOnly.length}, with ${LOOKBACK_MS / 1000}s lookback ${withLookback.length}`)

  // Names from events
  for (const e of withLookback) {
    const id = e.abilityGameID
    const n = e.ability?.name
    if (id && n && !nameById[id]) nameById[id] = n
  }

  const trackerFightOnly = buildStateTracker(inFightOnly, [], fightStart)
  const trackerLookback = buildStateTracker(withLookback, [], fightStart)

  const s0a = trackerFightOnly.getStateAt(0)
  const s0b = trackerLookback.getStateAt(0)

  const timestamps = [0, 0.05, 0.1, 0.25, 0.5, 1, 2]
  for (const tt of timestamps) {
    const st = trackerLookback.getStateAt(tt)
    console.log(`\nAt t=${tt}s WITH ${LOOKBACK_MS / 1000}s lookback — ${Object.keys(st).length} auras`)
    console.log(stateToLines(st, nameById).join('\n') || '  (none)')
  }

  console.log('\n--- Compare: in-fight window only replay (sanity) ---')
  const st1 = trackerFightOnly.getStateAt(1)
  console.log('At t=1s fight-only replay:', Object.keys(st1).length, 'auras')


  const onlyLookback = Object.keys(s0b).filter((k) => !s0a[k])
  if (onlyLookback.length) {
    console.log('\nIDs present at 0 ONLY when using lookback (sample prep/raid):')
    for (const id of onlyLookback.sort((a, b) => Number(a) - Number(b))) {
      console.log(`  ${id}  ${nameById[id] || '?'}`)
    }
  }
}

console.log('\nDone.')
