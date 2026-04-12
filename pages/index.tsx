import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import { gql, callAI } from '../lib/wclClient'
import { collectNames, resolveNames, fetchFullFightData, processFightData } from '../lib/fightAnalysis'
import type { AnalyzedFightData } from '../lib/fightAnalysis'
import { genVerifier, genChallenge } from '../lib/pkce'
import '../lib/spellTooltips'
import { buildRichContext } from '../lib/buildContext'
import { fetchTalents } from '../lib/talents'
import { TalentCompare } from '../components/TalentCompare'
import { SpellUsageChart, CastTimelineChart, ProcEfficiencyChart, CooldownTimelineChart, ChartCard } from '../components/Charts'
import { SpellTimeline } from '../components/Charts/SpellTimeline'
import { FormatAI, CopyBtn } from '../components/AIChat'
import { s, PRESET_QUESTIONS } from '../lib/styles'

interface SpellRow {
  id: string
  name: string
  ppm1: number; ppm2: number
  count1: number; count2: number
  first1: number | null; first2: number | null
  ts1: number[]; ts2: number[]
}

interface TalentDiffState {
  t1: any; t2: any; name1: string; name2: string; specId?: number; error?: string
}

interface FightMeta {
  id: number
  name: string
  startTime: number
  endTime: number
  kill: boolean
}

export default function Home() {
  const [compareUrl, setCompareUrl] = useState('')
  const [status, setStatus]         = useState<{ type: string; msg: string } | null>(null)
  const [loading, setLoading]       = useState(false)
  const [loadStep, setLoadStep]     = useState('')
  const [p1data, setP1data]         = useState<AnalyzedFightData | null>(null)
  const [p2data, setP2data]         = useState<AnalyzedFightData | null>(null)
  const [spellRows, setSpellRows]   = useState<SpellRow[]>([])
  const [talentDiff, setTalentDiff] = useState<TalentDiffState | null>(null)
  const [messages, setMessages]     = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput]           = useState('')
  const [aiLoading, setAiLoading]   = useState(false)
  const [bossName, setBossName]     = useState('')
  const [fightKill1, setFightKill1] = useState<boolean>(true)
  const [fightKill2, setFightKill2] = useState<boolean>(true)
  const chatRef = useRef<HTMLDivElement>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)

  const [authStatus, setAuthStatus] = useState<'checking' | 'ok' | 'needed'>('checking')
  const [clientId, setClientId]     = useState('')
  const [authMsg, setAuthMsg]       = useState<{ type: string; msg: string } | null>(null)

  useEffect(() => {
    if (aiLoading) {
      if (lastUserMsgRef.current && chatRef.current) {
        const msgTop = lastUserMsgRef.current.offsetTop
        chatRef.current.scrollTo({ top: msgTop - 12, behavior: 'smooth' })
      }
    } else {
      if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }
  }, [messages, aiLoading])

  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => setAuthStatus(d.authenticated ? 'ok' : 'needed')).catch(() => setAuthStatus('needed'))
  }, [])

  async function startAuth() {
    if (!clientId.trim()) { setAuthMsg({ type: 'err', msg: 'Enter your WCL Client ID.' }); return }
    sessionStorage.setItem('wcl_client_id', clientId.trim())
    const verifier = genVerifier()
    const state = Math.random().toString(36).slice(2)
    const challenge = await genChallenge(verifier)
    sessionStorage.setItem('wcl_pkce_verifier', verifier)
    sessionStorage.setItem('wcl_pkce_state', state)
    window.location.href = `https://www.warcraftlogs.com/oauth/authorize?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent('http://localhost:3000/auth/callback')}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`
  }

  async function loadCompare() {
    if (!compareUrl.trim()) { setStatus({ type: 'err', msg: 'Paste a WarcraftLogs compare URL.' }); return }
    let r1: string, r2: string, f1id: number, f2id: number, src1: string, src2: string
    try {
      const pm = compareUrl.match(/\/reports\/compare\/([^/]+)\/([^/?]+)/)
      if (!pm) throw new Error('Cannot find report codes in URL')
      r1 = pm[1]; r2 = pm[2]
      const u = new URL(compareUrl.startsWith('http') ? compareUrl : 'https://www.warcraftlogs.com' + compareUrl)
      const fights = (u.searchParams.get('fight') || '').split(',')
      f1id = parseInt(fights[0]); f2id = parseInt(fights[1] || fights[0])
      const srcs = (u.searchParams.get('source') || '').split(',')
      src1 = srcs[0]; src2 = srcs[1] || srcs[0]
    } catch (e: any) { setStatus({ type: 'err', msg: 'Could not parse URL: ' + e.message }); return }

    setLoading(true); setP1data(null); setP2data(null); setTalentDiff(null); setMessages([])

    try {
      setLoadStep('Fetching report metadata...')
      setStatus({ type: 'info', msg: 'Fetching report metadata...' })

      // Fetch ALL fights (not just kills) so wipes are included
      const [m1, m2] = await Promise.all([
        gql(`query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`, { c: r1 }),
        gql(`query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`, { c: r2 }),
      ])

      const fight1 = (m1 as any).reportData.report.fights.find((f: FightMeta) => f.id === f1id)
      const fight2 = (m2 as any).reportData.report.fights.find((f: FightMeta) => f.id === f2id)
      if (!fight1) throw new Error(`Fight ${f1id} not found in report ${r1}. Available fight IDs: ${(m1 as any).reportData.report.fights.map((f: FightMeta) => f.id).join(', ')}`)
      if (!fight2) throw new Error(`Fight ${f2id} not found in report ${r2}. Available fight IDs: ${(m2 as any).reportData.report.fights.map((f: FightMeta) => f.id).join(', ')}`)

      const isKill1 = fight1.kill === true
      const isKill2 = fight2.kill === true
      setFightKill1(isKill1)
      setFightKill2(isKill2)
      setBossName(fight1.name)

      if (!isKill1 || !isKill2) {
        const wipeNote = [
          !isKill1 && `${fight1.name} fight 1 is a wipe`,
          !isKill2 && `${fight2.name} fight 2 is a wipe`,
        ].filter(Boolean).join(', ')
        setStatus({ type: 'info', msg: `⚠ ${wipeNote} — loading anyway` })
      }

      const a1 = (m1 as any).reportData.report.masterData?.actors || []
      const a2 = (m2 as any).reportData.report.masterData?.actors || []
      const actor1 = isNaN(Number(src1)) ? a1.find((a: any) => a.name?.toLowerCase() === src1.toLowerCase() && a.type === 'Player') : a1.find((a: any) => a.id === parseInt(src1) && a.type === 'Player')
      const actor2 = isNaN(Number(src2)) ? a2.find((a: any) => a.name?.toLowerCase() === src2.toLowerCase() && a.type === 'Player') : a2.find((a: any) => a.id === parseInt(src2) && a.type === 'Player')
      const name1 = actor1?.name || src1; const name2 = actor2?.name || src2
      const spec1 = actor1?.subType || 'Unknown'; const spec2 = actor2?.subType || 'Unknown'

      setLoadStep(`Fetching all events for ${name1}...`)
      setStatus({ type: 'info', msg: `Fetching events for ${name1}...` })
      const raw1 = await fetchFullFightData({ reportCode: r1, fightStart: fight1.startTime, fightEnd: fight1.endTime, playerId: actor1?.id, setStep: setLoadStep })

      setLoadStep(`Fetching all events for ${name2}...`)
      setStatus({ type: 'info', msg: `Fetching events for ${name2}...` })
      const raw2 = await fetchFullFightData({ reportCode: r2, fightStart: fight2.startTime, fightEnd: fight2.endTime, playerId: actor2?.id, setStep: setLoadStep })

      // Use All killType for damage tables since fight may be a wipe
      const [d1, d2, t1, t2] = await Promise.all([
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`, { c: r1, s: fight1.startTime, e: fight1.endTime }),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`, { c: r2, s: fight2.startTime, e: fight2.endTime }),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e)}}}`, { c: r1, s: fight1.startTime, e: fight1.endTime }),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e)}}}`, { c: r2, s: fight2.startTime, e: fight2.endTime }),
      ])
      const dmgE1 = (d1 as any)?.reportData?.report?.table?.data?.entries || []
      const dmgE2 = (d2 as any)?.reportData?.report?.table?.data?.entries || []
      const dur1 = (fight1.endTime - fight1.startTime) / 1000
      const dur2 = (fight2.endTime - fight2.startTime) / 1000
      const myDmg = dmgE1.find((e: any) => e.name?.toLowerCase() === name1.toLowerCase())
      const thDmg = dmgE2.find((e: any) => e.name?.toLowerCase() === name2.toLowerCase())
      const tkE1 = (t1 as any)?.reportData?.report?.table?.data?.entries || []
      const tkE2 = (t2 as any)?.reportData?.report?.table?.data?.entries || []

      setLoadStep('Resolving spell names...')
      const nameMap: Record<number, string> = {}
      collectNames([...raw1.casts, ...raw1.buffs, ...raw1.debuffs, ...raw1.damage, ...raw2.casts, ...raw2.buffs, ...raw2.debuffs, ...raw2.damage], nameMap)
      const allIds = [...new Set([...raw1.casts, ...raw2.casts].map((e: any) => e.abilityGameID))]
      const resolvedNames = await resolveNames(allIds, nameMap)

      setLoadStep('Analyzing game state...')
      setStatus({ type: 'info', msg: 'Analyzing buff windows and cast data...' })

      const p1 = await processFightData({ raw: raw1, fightStart: fight1.startTime, fightEnd: fight1.endTime, playerId: actor1?.id, playerName: name1, spec: spec1, dps: myDmg ? Math.round(myDmg.total / dur1) : null, takenTotal: tkE1.find((e: any) => e.name?.toLowerCase() === name1.toLowerCase())?.total, nameMap: resolvedNames })
      const p2 = await processFightData({ raw: raw2, fightStart: fight2.startTime, fightEnd: fight2.endTime, playerId: actor2?.id, playerName: name2, spec: spec2, dps: thDmg ? Math.round(thDmg.total / dur2) : null, takenTotal: tkE2.find((e: any) => e.name?.toLowerCase() === name2.toLowerCase())?.total, nameMap: resolvedNames })

      // Attach kill status so buildRichContext can use it
      ;(p1 as any).isKill = isKill1
      ;(p2 as any).isKill = isKill2

      p1.boss = fight1.name; p2.boss = fight2.name
      const allSpellIds = new Set([...Object.keys(p1.spellMap), ...Object.keys(p2.spellMap)])
      const rows: SpellRow[] = [...allSpellIds].map(id => ({
        id, name: p1.spellMap[id]?.name || p2.spellMap[id]?.name || resolvedNames[Number(id)] || `Spell ${id}`,
        ppm1: p1.spellMap[id]?.ppm || 0, ppm2: p2.spellMap[id]?.ppm || 0,
        count1: p1.spellMap[id]?.count || 0, count2: p2.spellMap[id]?.count || 0,
        first1: p1.spellMap[id]?.ts[0] ?? null, first2: p2.spellMap[id]?.ts[0] ?? null,
        ts1: p1.spellMap[id]?.ts || [], ts2: p2.spellMap[id]?.ts || [],
      })).sort((a, b) => Math.max(b.ppm1, b.ppm2) - Math.max(a.ppm1, a.ppm2))

      p1.spellRows = rows; p2.spellRows = rows
      setP1data(p1); setP2data(p2); setSpellRows(rows)

      const wipeWarning = (!isKill1 || !isKill2)
        ? ` ⚠ ${[!isKill1 && `${name1}: wipe`, !isKill2 && `${name2}: wipe`].filter(Boolean).join(' · ')}`
        : ''
      setStatus({ type: 'ok', msg: `✓ Loaded — ${name1} (${spec1}) vs ${name2} (${spec2}) on ${fight1.name}${wipeWarning}` })

      setLoadStep('Fetching talent data...')
      Promise.all([
        fetchTalents({ reportCode: r1, fightId: f1id, fightStart: fight1.startTime, fightEnd: fight1.endTime, playerName: name1, playerId: actor1?.id, gql }),
        fetchTalents({ reportCode: r2, fightId: f2id, fightStart: fight2.startTime, fightEnd: fight2.endTime, playerName: name2, playerId: actor2?.id, gql }),
      ]).then(([tt1, tt2]) => {
        function resolveTalentNames(talentData: any) {
          if (!talentData) return talentData
          return {
            ...talentData,
            talentTree: (talentData.talentTree || []).map((t: any) => ({
              ...t,
              id: t.spellId || t.id,
              name: resolvedNames[t.spellId || t.id] || t.name || `Talent ${t.spellId || t.id}`,
            })),
          }
        }
        const specId = tt1?.specID || tt2?.specID || undefined
        setTalentDiff({ t1: resolveTalentNames(tt1), t2: resolveTalentNames(tt2), name1, name2, specId })
      }).catch(e => {
        console.warn('Talent fetch failed:', e)
        setTalentDiff({ t1: null, t2: null, name1, name2, error: e.message })
      })

      const ctx = buildRichContext(p1, p2, talentDiff, { isKill1, isKill2 })
      await runAI(
        `Analyze the fight data and respond in two parts:\n\n**Part 1 — Priority Summary**\nGive me a numbered list of the top 5 most impactful changes ${name1} should make, ordered by DPS impact. For each one, give a one-line description of what to change and why it matters. Keep this section tight — no more than 2 sentences per item.\n\n**Part 2 — Full Analysis**\nGo deep on each of the 5 items above. For each one:\n- What exactly is happening in the data (with specific numbers and timestamps)\n- The mechanical reason WHY it costs DPS\n- Exactly WHEN and HOW to make the decision differently\n\n${(!isKill1 || !isKill2) ? `NOTE: ${[!isKill1 && `${name1}'s fight is a wipe`, !isKill2 && `${name2}'s fight is a wipe`].filter(Boolean).join(', ')}. Account for this — the fight ended early so late-phase cooldown usage and fight-end DPS patterns are not available. Focus on opener, early rotation, and mid-fight decisions.\n\n` : ''}Link every spell name to Wowhead using this format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)\nUse the spell IDs from the data. Both players are ${spec1} spec.`,
        [], ctx
      )

    } catch (e: any) {
      setStatus({ type: 'err', msg: 'Error: ' + e.message })
      console.error(e)
    } finally {
      setLoading(false); setLoadStep('')
    }
  }

  function buildContext() {
    if (!p1data || !p2data) return ''
    return buildRichContext(p1data, p2data, talentDiff, { isKill1: fightKill1, isKill2: fightKill2 })
  }

  async function runAI(userMsg: string, existingMessages: typeof messages, ctxOverride?: string) {
    if (!p1data && !ctxOverride) return
    setAiLoading(true)
    const ctx = ctxOverride || buildContext()
    const newMessages = [...existingMessages, { role: 'user', content: userMsg }]
    try {
      const reply = await callAI(newMessages, ctx)
      setMessages([...newMessages, { role: 'assistant', content: reply }].slice(-20))
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: 'Error: ' + e.message }])
    }
    setAiLoading(false)
  }

  function sendQuestion(q?: string) {
    if (aiLoading || (!p1data && !p2data)) return
    const msg = q || input.trim(); if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    runAI(msg, messages)
  }

  function downloadData() {
    if (!p1data || !p2data) return
    const ctx = buildContext()
    const blob = new Blob([ctx], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `parse-${p1data.name}-vs-${p2data.name}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  const dur1Fmt = p1data ? `${Math.floor(p1data.dur / 60)}:${String(Math.round(p1data.dur % 60)).padStart(2, '0')}` : ''
  const dur2Fmt = p2data ? `${Math.floor(p2data.dur / 60)}:${String(Math.round(p2data.dur % 60)).padStart(2, '0')}` : ''

  return (
    <>
      <Head><title>Parse Analyzer</title></Head>
      <div style={s.wrap}>
        <div style={s.hdr}>
          <div><div style={s.logo}>PARSE ANALYZER</div><div style={s.logoSub}>AI-Powered · Deep Fight Analysis</div></div>
          <span style={s.badge}>✦ Claude AI</span>
        </div>

        {/* AUTH */}
        {authStatus === 'checking' && <div style={s.panel}><div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim)' }}>Checking WarcraftLogs connection...</div></div>}
        {authStatus === 'needed' && (
          <div style={s.panel}>
            <div style={s.ptitle}><div style={s.ptitleBar} />Connect to WarcraftLogs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
              <div style={s.field}><label style={s.label}>WarcraftLogs Client ID</label><input style={s.input} value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" onKeyDown={e => e.key === 'Enter' && startAuth()} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}><button style={s.btnGold} onClick={startAuth}>Authenticate</button></div>
            </div>
            {authMsg && <div style={authMsg.type === 'err' ? s.alertErr : s.alertInfo}>{authMsg.msg}</div>}
            <div style={s.note}>Create a public client at <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">warcraftlogs.com/api/clients</a> with redirect URL <code style={{ background: 'var(--bg4)', padding: '1px 5px', borderRadius: 3, color: 'var(--blue)' }}>http://localhost:3000/auth/callback</code></div>
          </div>
        )}
        {authStatus === 'ok' && (
          <div style={{ ...s.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--green)' }}>● WarcraftLogs connected</div>
            <button style={s.btnGhost} onClick={() => setAuthStatus('needed')}>Reconnect</button>
          </div>
        )}

        {/* COMPARE URL */}
        <div style={s.panel}>
          <div style={s.ptitle}><div style={s.ptitleBar} />Compare</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
            <div style={s.field}>
              <label style={s.label}>WarcraftLogs Compare URL</label>
              <input style={s.input} value={compareUrl} onChange={e => setCompareUrl(e.target.value)} placeholder="https://www.warcraftlogs.com/reports/compare/..." onKeyDown={e => e.key === 'Enter' && !loading && loadCompare()} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button style={loading ? s.btnGoldDis : s.btnGold} disabled={loading} onClick={loadCompare}>
                {loading ? (loadStep || 'Loading...') : 'Load & Analyze'}
              </button>
            </div>
          </div>
          {status && <div style={status.type === 'err' ? s.alertErr : status.type === 'ok' ? s.alertOk : s.alertInfo}>{status.msg}</div>}
        </div>

        {/* DATA CARDS */}
        {p1data && p2data && (
          <div style={s.panel}>
            <div style={{ ...s.ptitle, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={s.ptitleBar} />{bossName}</div>
              <button style={s.btnGhost} onClick={downloadData}>Download Data</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { data: p1data, dur: dur1Fmt, color: 'var(--gold2)', label: 'you', isKill: fightKill1 },
                { data: p2data, dur: dur2Fmt, color: 'var(--blue)', label: 'comparison', isKill: fightKill2 },
              ].map((p, i) => (
                <div key={i} style={{ background: 'var(--bg3)', border: `1px solid ${p.isKill ? 'var(--border)' : 'rgba(212,64,64,0.3)'}`, borderRadius: 4, padding: '10px 13px' }}>
                  <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: p.color, marginBottom: 4 }}>
                    {p.data.name} — {p.label}
                    {!p.isKill && <span style={{ marginLeft: 8, color: 'var(--red)', fontSize: 9 }}>WIPE</span>}
                  </div>
                  <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 22, fontWeight: 700, color: p.color, lineHeight: 1.2 }}>{p.data.dps?.toLocaleString() || '?'} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--dim)' }}>dps</span></div>
                  <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{p.dur} · {p.data.downtime.cpm}/min · {p.data.downtime.pct}% downtime · {p.data.spec}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    {(() => {
                      const topBuffs = Object.entries(p.data.uptimes || {})
                        .map(([id, pct]) => ({ name: p.data.nameMap?.[Number(id)] || `Buff ${id}`, pct: pct as number }))
                        .filter(b => b.pct > 0 && !b.name.startsWith('Buff '))
                        .sort((a, b) => b.pct - a.pct)
                        .slice(0, 3)
                      return topBuffs.length > 0 ? (
                        <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim)' }}>
                          {topBuffs.map((b, bi) => (
                            <span key={bi}>{bi > 0 && ' · '}{b.name}: <span style={{ color: p.color }}>{b.pct}%</span></span>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* Spell table */}
            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Spell breakdown — casts/min</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr>{['Spell', p1data.name, p2data.name, 'Diff', 'First cast'].map((h, i) => (
                  <th key={i} style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, letterSpacing: '.8px', textTransform: 'uppercase', color: i === 1 ? 'var(--gold2)' : i === 2 ? 'var(--blue)' : 'var(--dim)', padding: '5px 8px', textAlign: i > 0 ? 'right' : 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{spellRows.filter(r => r.ppm1 > 0 || r.ppm2 > 0).map((r, i) => {
                  const diff = r.ppm2 > 0 ? Math.round((r.ppm1 - r.ppm2) / r.ppm2 * 100) : null
                  const dc = diff === null ? 'var(--dim)' : diff > 5 ? 'var(--green)' : diff < -5 ? 'var(--red)' : 'var(--dim)'
                  const ft = r.first1 !== null && r.first2 !== null && Math.abs(r.first1 - r.first2) > 1.5
                  return (
                    <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg4)', fontFamily: 'IBM Plex Mono,monospace', color: 'var(--muted)' }}>
                        <a href={`https://www.wowhead.com/spell=${r.id}`} target="_blank" rel="noreferrer" data-wh-spell={r.id} data-wh-name={r.name} style={{ color: 'var(--muted)', textDecoration: 'none', borderBottom: '1px dotted var(--dim)', cursor: 'help' }}>{r.name}</a>
                      </td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg4)', fontFamily: 'IBM Plex Mono,monospace', color: 'var(--gold2)', textAlign: 'right' }}>{r.ppm1}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg4)', fontFamily: 'IBM Plex Mono,monospace', color: 'var(--blue)', textAlign: 'right' }}>{r.ppm2}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg4)', fontFamily: 'IBM Plex Mono,monospace', color: dc, textAlign: 'right' }}>{diff === null ? '—' : (diff >= 0 ? '+' : '') + diff + '%'}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg4)', fontSize: 11 }}>{ft && <><span style={{ color: 'var(--gold2)' }}>{r.first1}s</span> vs <span style={{ color: 'var(--blue)' }}>{r.first2}s</span></>}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHARTS */}
        {p1data && p2data && (
          <div style={s.panel}>
            <div style={s.ptitle}><div style={s.ptitleBar} />Charts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <ChartCard title="Spell usage — casts/min" height={240}>
                <SpellUsageChart spellRows={spellRows} name1={p1data.name} name2={p2data.name} />
              </ChartCard>
              <ChartCard title="Cast rate over time (30s windows)" height={240}>
                <CastTimelineChart p1data={p1data} p2data={p2data} />
              </ChartCard>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <ChartCard title="Buff uptime %" height={200}>
                <ProcEfficiencyChart p1data={p1data} p2data={p2data} />
              </ChartCard>
              <ChartCard title="Cooldown timeline" height={200}>
                <CooldownTimelineChart p1data={p1data} p2data={p2data} spellRows={spellRows} />
              </ChartCard>
            </div>
            {/* Spell Timeline — zoomable, pannable */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 10 }}>
                Spell cast timeline
              </div>
              <SpellTimeline
                spellRows={spellRows}
                name1={p1data.name}
                name2={p2data.name}
                dur1={p1data.dur}
                dur2={p2data.dur}
              />
            </div>
          </div>
        )}

        {/* TALENT COMPARE */}
        {talentDiff && (
          <div style={s.panel}>
            <div style={s.ptitle}><div style={s.ptitleBar} />Talent Comparison</div>
            {talentDiff.error && !talentDiff.t1 && !talentDiff.t2
              ? <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim)' }}>Could not load talent data: {talentDiff.error}</div>
              : <TalentCompare p1Talents={talentDiff.t1} p2Talents={talentDiff.t2} name1={talentDiff.name1} name2={talentDiff.name2} specId={talentDiff.specId} />
            }
          </div>
        )}

        {/* CHAT */}
        {p1data && p2data && (
          <div style={s.panel}>
            <div style={{ ...s.ptitle, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={s.ptitleBar} />Ask Claude</div>
              {messages.length > 0 && <CopyBtn text={messages.map(m => `${m.role === 'user' ? 'You' : 'Claude'}:\n${m.content}`).join('\n\n---\n\n')} label="Copy All" />}
            </div>
            <div ref={chatRef} style={{ display: 'flex', flexDirection: 'column', maxHeight: 560, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
              {messages.map((m, i) => {
                const isLastUser = m.role === 'user' && messages.slice(i + 1).every(x => x.role !== 'user')
                return (
                  <div key={i} ref={isLastUser ? lastUserMsgRef : null} style={{ marginBottom: m.role === 'user' ? 8 : 12 }}>
                    {m.role === 'user'
                      ? <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px 6px 2px 6px', padding: '8px 12px', fontSize: 12, color: 'var(--muted)', alignSelf: 'flex-end', maxWidth: '74%', marginLeft: 'auto' }}>{m.content}</div>
                      : <div style={{ position: 'relative' }}>
                          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '2px 6px 6px 6px', padding: '13px 15px 36px 15px', fontSize: 13, lineHeight: 1.85 }}>
                            <FormatAI text={m.content} />
                          </div>
                          <div style={{ position: 'absolute', bottom: 8, right: 10 }}><CopyBtn text={m.content} label="Copy" /></div>
                        </div>
                    }
                  </div>
                )
              })}
              {aiLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 15px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '2px 6px 6px 6px', marginBottom: 10 }}>
                  {[0, 200, 400].map(d => <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--dim)', animation: `td 1.2s ${d}ms infinite` }} />)}
                  <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Mono,monospace', marginLeft: 6 }}>Analyzing...</span>
                </div>
              )}
              <div ref={scrollAnchorRef} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Mono,monospace', marginBottom: 6 }}>Quick questions:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
              {PRESET_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendQuestion(q)} disabled={aiLoading}
                  style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--muted)', cursor: aiLoading ? 'not-allowed' : 'pointer', textAlign: 'left', lineHeight: 1.4 }}
                  onMouseEnter={e => { if (!aiLoading) { (e.target as HTMLButtonElement).style.borderColor = 'var(--golddim)'; (e.target as HTMLButtonElement).style.color = 'var(--gold)' } }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.target as HTMLButtonElement).style.color = 'var(--muted)' }}>
                  {q}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={s.input} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask anything — why am I losing DPS, when should I hold cooldowns, etc." onKeyDown={e => e.key === 'Enter' && sendQuestion()} disabled={aiLoading} />
              <button style={aiLoading ? s.btnGoldDis : s.btnGold} onClick={() => sendQuestion()} disabled={aiLoading}>Ask</button>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}} input:focus{border-color:var(--golddim)!important;outline:none;}`}</style>
    </>
  )
}
