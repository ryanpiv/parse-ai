import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import { buildStateTracker, buildTargetTracker, buildDamageLookup, annotateCasts, detectSequences, computeUptimes, computeCastSpacing } from '../lib/gameState'
import { buildRichContext } from '../lib/buildContext'
import { fetchTalents, TalentCompare, fetchTalentTreeLayout } from '../components/TalentCompare'
import { SpellUsageChart, CastTimelineChart, ProcEfficiencyChart, CooldownTimelineChart, ChartCard } from '../components/Charts'

// ── PKCE ──────────────────────────────────────────────────────────────────────
function genVerifier() {
  const a = new Uint8Array(32); crypto.getRandomValues(a)
  return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
async function genChallenge(v) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await fetch('/api/wcl', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query, variables }) })
  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0].message)
  if (data.error) throw new Error(data.error)
  return data.data
}

async function callAI(messages, system) {
  const res = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000, system, messages }) })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.content?.[0]?.text || 'No response.'
}

// ── Spell name resolution ─────────────────────────────────────────────────────
function collectNames(events, map) {
  events.forEach(ev => { if (ev.abilityGameID && ev.ability?.name) map[ev.abilityGameID] = ev.ability.name })
}

async function resolveNames(ids, known) {
  const missing = ids.filter(id => !known[id])
  if (!missing.length) return known
  const result = { ...known }
  for (let i = 0; i < missing.length; i += 20) {
    const batch = missing.slice(i, i + 20)
    try {
      const fields = batch.map((id, j) => `s${j}: ability(id: ${id}) { name }`).join('\n')
      const data = await gql(`query { gameData { ${fields} } }`)
      batch.forEach((id, j) => { const n = data?.gameData?.[`s${j}`]?.name; if (n) result[id] = n })
    } catch { /* keep Spell ID fallback */ }
  }
  return result
}

// ── Full fight data fetcher ───────────────────────────────────────────────────
async function fetchFullFightData({ reportCode, fightStart, fightEnd, playerId, setStep }) {
  setStep('Fetching cast events...')
  const [castData, buffData, debuffData, damageData, enemyDeathData] = await Promise.all([
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){reportData{report(code:$c){events(dataType:Casts,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}}}}`, { c:reportCode, s:fightStart, e:fightEnd, src:playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!,$tgt:Int!){reportData{report(code:$c){events(dataType:Buffs,startTime:$s,endTime:$e,targetID:$tgt,limit:10000){data}}}}`, { c:reportCode, s:fightStart, e:fightEnd, tgt:playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){reportData{report(code:$c){events(dataType:Debuffs,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}}}}`, { c:reportCode, s:fightStart, e:fightEnd, src:playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){reportData{report(code:$c){events(dataType:DamageDone,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}}}}`, { c:reportCode, s:fightStart, e:fightEnd, src:playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){events(dataType:Deaths,startTime:$s,endTime:$e,limit:10000){data}}}}`, { c:reportCode, s:fightStart, e:fightEnd }),
  ])
  return {
    casts:   castData?.reportData?.report?.events?.data || [],
    buffs:   buffData?.reportData?.report?.events?.data || [],
    debuffs: debuffData?.reportData?.report?.events?.data || [],
    damage:  damageData?.reportData?.report?.events?.data || [],
    deaths:  enemyDeathData?.reportData?.report?.events?.data || [],
  }
}

// ── Process all fight data into analysis ──────────────────────────────────────
async function processFightData({ raw, fightStart, fightEnd, playerId, playerName, spec, dps, takenTotal, nameMap }) {
  const dur = (fightEnd - fightStart) / 1000
  const { casts, buffs, debuffs, damage, deaths } = raw

  // Filter to this player's casts
  const playerCasts = casts.filter(e => e.type === 'cast' && e.sourceID === playerId)

  // Build state tracker from buff/debuff events
  const { getStateAt, buffWindows } = buildStateTracker(buffs, debuffs, fightStart)
  const { getNPCDeathsBy, npcDeaths } = buildTargetTracker(deaths, fightStart)
  const { getDamageAfterCast, getCritRate } = buildDamageLookup(damage, fightStart)

  // Annotate each cast with full game state
  const annotated = annotateCasts(playerCasts, { getStateAt, getDamageAfterCast, getNPCDeathsBy, fightStart, nameMap })

  // Detect combo sequences
  const sequences = detectSequences(annotated, dur)

  // Compute buff uptimes
  const uptimes = computeUptimes(buffWindows, dur)

  // Cast spacing
  const spacing = computeCastSpacing(annotated)

  // Downtime
  const sc = [...playerCasts].sort((a,b) => a.timestamp - b.timestamp)
  let dt = 0; const dtWins = []
  for (let i=1; i<sc.length; i++) { const g=(sc[i].timestamp-sc[i-1].timestamp)/1000; if(g>1.5&&g<30){dt+=g-1.5;dtWins.push({g:+g.toFixed(1)})}}
  const downtime = { pct:Math.round(dt/dur*100), sec:Math.round(dt), wins:dtWins.sort((a,b)=>b.g-a.g).slice(0,6), cpm:Math.round(playerCasts.length/dur*60), total:playerCasts.length }

  // Opener
  const opener = annotated.filter(c => c.t <= 20).map(c => ({ name:c.name, at:c.t }))

  // Spell map for table display
  const spellMap = {}
  annotated.forEach(c => {
    const id = String(c.id)
    if (!spellMap[id]) spellMap[id] = { name:c.name, id, count:0, ts:[], ppm:0 }
    spellMap[id].count++
    spellMap[id].ts.push(c.t)
  })
  Object.values(spellMap).forEach(s => { s.ppm = parseFloat((s.count/dur*60).toFixed(2)) })

  // Icy Veins windows from buffWindows
  const IV_IDS = [12472, 382252]
  const icyVeinsWindows = []
  IV_IDS.forEach(id => { if (buffWindows[id]) icyVeinsWindows.push(...buffWindows[id]) })
  icyVeinsWindows.sort((a,b) => a.start-b.start)

  // Crit rates for key spells
  const critRates = {}
  Object.keys(spellMap).forEach(id => { const r = getCritRate(Number(id)); if (r !== null) critRates[id] = Math.round(r*100) })

  return {
    name: playerName, spec, dps, takenTotal, dur, nameMap,
    downtime, opener, spellMap, sequences, uptimes, spacing,
    icyVeinsWindows, critRates, annotated, buffWindows, npcDeaths,
  }
}

// ── Wowhead tooltip system (custom, event-delegated) ─────────────────────────
let _ttEl = null, _ttTimer = null, _ttActive = null

function _getTT() {
  if (!_ttEl && typeof document !== 'undefined') {
    _ttEl = document.createElement('div')
    _ttEl.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;background:#111418;border:1px solid #2a3340;border-radius:6px;padding:0;max-width:320px;font-size:12px;color:#e8edf2;font-family:IBM Plex Sans,sans-serif;display:none;box-shadow:0 6px 24px rgba(0,0,0,.8);overflow:hidden'
    document.body.appendChild(_ttEl)
  }
  return _ttEl
}

function _positionTT(e) {
  const el = _getTT(); if (!el) return
  const x = Math.min(e.clientX + 16, window.innerWidth - 336)
  const y = Math.min(e.clientY + 16, window.innerHeight - 260)
  el.style.left = x + 'px'; el.style.top = y + 'px'
}

async function _showTT(e, spellId, knownName) {
  if (_ttActive === spellId) { _positionTT(e); return }
  clearTimeout(_ttTimer)
  _ttActive = spellId
  const el = _getTT(); if (!el) return
  el.style.display = 'block'
  el.innerHTML = '<div style="padding:10px 12px;color:#4a5a6a;font-family:IBM Plex Mono,monospace;font-size:11px">Loading...</div>'
  _positionTT(e)
  try {
    const res = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=11&locale=0`)
    const d = await res.json()
    if (_ttActive !== spellId) return
    const iconUrl = d.icon ? `https://wow.zamimg.com/images/wow/icons/medium/${d.icon}.jpg` : ''
    // Use knownName from our WCL data — more accurate than what Wowhead resolves
    const displayName = knownName || d.name || 'Spell ' + spellId
    const header = `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #1e252e;background:#0a0c0f">
      ${iconUrl ? `<img src="${iconUrl}" style="width:36px;height:36px;border-radius:4px;border:1px solid #2a3340;flex-shrink:0" onerror="this.style.display='none'"/>` : ''}
      <div style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:600;color:#e8be40;letter-spacing:.5px">${displayName}</div>
    </div>`
    const body = (d.tooltip || '')
      .replace(/<table[^>]*>/gi,'<div>').replace(/<\/table>/gi,'</div>')
      .replace(/<tr[^>]*>/gi,'<div style="margin-bottom:2px">').replace(/<\/tr>/gi,'</div>')
      .replace(/<td[^>]*>/gi,'<span style="margin-right:4px">').replace(/<\/td>/gi,'</span>')
      .replace(/<th[^>]*>.*?<\/th>/gi,'')
    el.innerHTML = header + `<div style="padding:10px 12px;font-size:12px;color:#8a9bb0;line-height:1.6;max-height:200px;overflow-y:auto">${body || 'Spell ID: ' + spellId}</div>`
    _positionTT(e)
  } catch {
    if (_ttActive !== spellId) return
    el.innerHTML = `<div style="padding:10px 12px"><span style="color:#e8be40;font-family:Rajdhani,sans-serif">${knownName || 'Spell ' + spellId}</span></div>`
  }
}

function _hideTT() {
  clearTimeout(_ttTimer)
  _ttActive = null
  _ttTimer = setTimeout(() => { if (_ttEl) _ttEl.style.display = 'none' }, 150)
}

// Use event delegation on document so dynamically-rendered links always work
if (typeof document !== 'undefined') {
  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[data-wh-spell]')
    if (a) { _showTT(e, a.dataset.whSpell, a.dataset.whName); e.stopPropagation() }
  })
  document.addEventListener('mousemove', e => {
    if (e.target.closest('a[data-wh-spell]')) _positionTT(e)
  })
  document.addEventListener('mouseout', e => {
    const a = e.target.closest('a[data-wh-spell]')
    if (a && !a.contains(e.relatedTarget)) _hideTT()
  })
}

// Keep attachSpellTooltips as no-op — delegation handles everything now
function attachSpellTooltips() {}

// ── Format AI markdown ────────────────────────────────────────────────────────
function FormatAI({ text }) {
  const ref = useRef(null)

  // Re-attach tooltips every time content renders
  useEffect(() => {
    if (ref.current) attachSpellTooltips(ref.current)
  })

  const lines = text.split('\n'); const elements = []; let listItems = []
  function flushList() {
    if (!listItems.length) return
    elements.push(<ul key={elements.length} style={{paddingLeft:18,margin:'6px 0'}}>{listItems.map((li,i)=><li key={i} style={{marginBottom:4,color:'var(--muted)'}} dangerouslySetInnerHTML={{__html:li}}/>)}</ul>)
    listItems = []
  }
  const format = t => t
    .replace(/\[([^\]]+)\]\(https?:\/\/www\.wowhead\.com\/spell=(\d+)[^)]*\)/g,
      '<a href="https://www.wowhead.com/spell=$2" target="_blank" rel="noreferrer" data-wh-spell="$2" data-wh-name="$1" style="color:var(--blue);text-decoration:none;border-bottom:1px dotted rgba(90,173,240,.5);cursor:help">$1</a>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--gold);font-weight:500">$1</strong>')
    .replace(/`([^`]+)`/g,'<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-size:11px;color:var(--blue)">$1</code>')

  lines.forEach((line,i) => {
    if (line.startsWith('### ')||line.startsWith('## ')) {
      flushList()
      // Strip bold markers from headings too
      const headText = line.replace(/^#+\s/,'').replace(/\*\*/g,'')
      elements.push(<h3 key={i} style={{fontFamily:'Rajdhani,sans-serif',fontSize:15,fontWeight:600,color:'var(--gold2)',margin:'14px 0 5px',letterSpacing:'.5px'}} dangerouslySetInnerHTML={{__html:format(headText)}}/>)
    } else if (line.startsWith('- ')) {
      listItems.push(format(line.slice(2)))
    } else if (line.trim()==='') {
      flushList()
    } else {
      flushList()
      elements.push(<p key={i} style={{marginBottom:7,color:'var(--muted)'}} dangerouslySetInnerHTML={{__html:format(line)}}/>)
    }
  })
  flushList()
  return <div ref={ref}>{elements}</div>
}

// ── Copy button with feedback ─────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={doCopy} style={{
      fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11,
      letterSpacing: '.8px', textTransform: 'uppercase', padding: '4px 10px',
      borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer',
      background: copied ? '#102a18' : 'var(--bg4)',
      color: copied ? 'var(--green)' : 'var(--dim)',
      transition: 'all .15s', whiteSpace: 'nowrap',
    }}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  wrap:     {maxWidth:1200,margin:'0 auto',padding:'24px 20px'},
  hdr:      {display:'flex',alignItems:'flex-end',justifyContent:'space-between',borderBottom:'1px solid var(--border)',paddingBottom:16,marginBottom:22},
  logo:     {fontFamily:'Rajdhani,sans-serif',fontSize:23,fontWeight:700,letterSpacing:2,color:'var(--gold2)'},
  logoSub:  {fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'var(--dim)',marginTop:1},
  badge:    {fontFamily:'IBM Plex Mono,monospace',fontSize:10,padding:'3px 8px',borderRadius:3,border:'1px solid rgba(168,85,247,.3)',background:'rgba(168,85,247,.08)',color:'var(--purple)'},
  panel:    {background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'16px 18px',marginBottom:12},
  ptitle:   {fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:600,letterSpacing:'1.2px',textTransform:'uppercase',color:'var(--muted)',marginBottom:12,display:'flex',alignItems:'center',gap:7},
  ptitleBar:{width:3,height:12,background:'var(--gold)',borderRadius:2,flexShrink:0},
  field:    {display:'flex',flexDirection:'column',gap:4},
  label:    {fontFamily:'Rajdhani,sans-serif',fontSize:10,fontWeight:600,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--dim)'},
  input:    {background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',padding:'7px 10px',fontFamily:'IBM Plex Mono,monospace',fontSize:12,outline:'none',width:'100%'},
  btnGold:  {fontFamily:'Rajdhani,sans-serif',fontWeight:600,fontSize:13,letterSpacing:1,textTransform:'uppercase',padding:'9px 22px',borderRadius:4,border:'none',cursor:'pointer',background:'var(--gold)',color:'#0a0c0f',whiteSpace:'nowrap'},
  btnGoldDis:{fontFamily:'Rajdhani,sans-serif',fontWeight:600,fontSize:13,letterSpacing:1,textTransform:'uppercase',padding:'9px 22px',borderRadius:4,border:'none',cursor:'not-allowed',background:'var(--golddim)',color:'var(--dim)',whiteSpace:'nowrap'},
  btnGhost: {fontFamily:'Rajdhani,sans-serif',fontWeight:600,fontSize:11,letterSpacing:1,textTransform:'uppercase',padding:'6px 14px',borderRadius:3,border:'1px solid var(--border)',cursor:'pointer',background:'transparent',color:'var(--dim)',whiteSpace:'nowrap'},
  note:     {fontSize:11,color:'var(--dim)',fontFamily:'IBM Plex Mono,monospace',marginTop:8,lineHeight:1.7},
  alertInfo:{fontFamily:'IBM Plex Mono,monospace',fontSize:12,padding:'9px 12px',borderRadius:4,marginTop:8,lineHeight:1.7,background:'var(--bluedim)',color:'var(--blue)',border:'1px solid #1e4a70'},
  alertErr: {fontFamily:'IBM Plex Mono,monospace',fontSize:12,padding:'9px 12px',borderRadius:4,marginTop:8,lineHeight:1.7,background:'#3a1010',color:'var(--red)',border:'1px solid #5a2020'},
  alertOk:  {fontFamily:'IBM Plex Mono,monospace',fontSize:12,padding:'9px 12px',borderRadius:4,marginTop:8,lineHeight:1.7,background:'#102a18',color:'var(--green)',border:'1px solid #1a4a28'},
}

const PRESET_QUESTIONS = [
  'Where is my rotation different and why does it matter?',
  "What's wrong with my opener?",
  'Am I using my procs efficiently? Where am I wasting FoF or Brain Freeze?',
  'How should I be using Frozen Orb relative to Icy Veins and Ray of Frost?',
  'When should I hold Frozen Orb for adds vs use it immediately?',
  'What is the comparison player doing in their Icy Veins windows that I am not?',
  'Am I using Alter Time correctly?',
  'How can I improve my Glacial Spike combo execution?',
  'What is causing my downtime and how do I fix it?',
  'Give me a priority list of exactly what to fix first.',
]

const PRESET_COLS = [
  PRESET_QUESTIONS.slice(0, 5),
  PRESET_QUESTIONS.slice(5),
]

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [compareUrl, setCompareUrl] = useState('')
  const [status, setStatus]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [loadStep, setLoadStep]     = useState('')
  const [p1data, setP1data]         = useState(null)
  const [p2data, setP2data]         = useState(null)
  const [spellRows, setSpellRows]   = useState([])
  const [talentDiff, setTalentDiff] = useState(null)
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [aiLoading, setAiLoading]   = useState(false)
  const [bossName, setBossName]     = useState('')
  const chatRef = useRef(null)
  const scrollAnchorRef = useRef(null)
  const lastUserMsgRef = useRef(null)

  const [authStatus, setAuthStatus] = useState('checking')
  const [clientId, setClientId]     = useState('')
  const [authMsg, setAuthMsg]       = useState(null)

  // When AI is loading, scroll last user message to top of chat window
  // When AI response arrives, scroll to bottom so response is visible
  useEffect(() => {
    if (aiLoading) {
      // Scroll user message to top
      if (lastUserMsgRef.current && chatRef.current) {
        const msgTop = lastUserMsgRef.current.offsetTop
        chatRef.current.scrollTo({ top: msgTop - 12, behavior: 'smooth' })
      }
    } else {
      // AI responded — scroll to bottom to show full response
      if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }
    // Refresh Wowhead tooltips on new content
    if (typeof window !== 'undefined' && window.WH?.Tooltips) {
      setTimeout(() => window.WH.Tooltips.refreshLinks(), 100)
    }
  }, [messages, aiLoading])
  useEffect(() => { fetch('/api/auth').then(r=>r.json()).then(d=>setAuthStatus(d.authenticated?'ok':'needed')).catch(()=>setAuthStatus('needed')) }, [])

  async function startAuth() {
    if (!clientId.trim()) { setAuthMsg({type:'err',msg:'Enter your WCL Client ID.'}); return }
    sessionStorage.setItem('wcl_client_id', clientId.trim())
    const verifier = genVerifier(); const state = Math.random().toString(36).slice(2); const challenge = await genChallenge(verifier)
    sessionStorage.setItem('wcl_pkce_verifier', verifier); sessionStorage.setItem('wcl_pkce_state', state)
    window.location.href = `https://www.warcraftlogs.com/oauth/authorize?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent('http://localhost:3000/auth/callback')}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadCompare() {
    if (!compareUrl.trim()) { setStatus({type:'err',msg:'Paste a WarcraftLogs compare URL.'}); return }
    let r1,r2,f1id,f2id,src1,src2
    try {
      const pm = compareUrl.match(/\/reports\/compare\/([^/]+)\/([^/?]+)/)
      if (!pm) throw new Error('Cannot find report codes in URL')
      r1=pm[1]; r2=pm[2]
      const u = new URL(compareUrl.startsWith('http')?compareUrl:'https://www.warcraftlogs.com'+compareUrl)
      const fights=(u.searchParams.get('fight')||'').split(',')
      f1id=parseInt(fights[0]); f2id=parseInt(fights[1]||fights[0])
      const srcs=(u.searchParams.get('source')||'').split(',')
      src1=srcs[0]; src2=srcs[1]||srcs[0]
    } catch(e) { setStatus({type:'err',msg:'Could not parse URL: '+e.message}); return }

    setLoading(true); setP1data(null); setP2data(null); setTalentDiff(null); setMessages([])

    try {
      setLoadStep('Fetching report metadata...')
      setStatus({type:'info',msg:'Fetching report metadata...'})
      const [m1,m2] = await Promise.all([
        gql(`query($c:String!){reportData{report(code:$c){title fights(killType:Kills){id name startTime endTime} masterData{actors{id name type subType}}}}}`  ,{c:r1}),
        gql(`query($c:String!){reportData{report(code:$c){title fights(killType:Kills){id name startTime endTime} masterData{actors{id name type subType}}}}}`,{c:r2}),
      ])
      const fight1 = m1.reportData.report.fights.find(f=>f.id===f1id)
      const fight2 = m2.reportData.report.fights.find(f=>f.id===f2id)
      if (!fight1) throw new Error(`Fight ${f1id} not found in ${r1}`)
      if (!fight2) throw new Error(`Fight ${f2id} not found in ${r2}`)
      setBossName(fight1.name)

      const a1 = m1.reportData.report.masterData?.actors||[]
      const a2 = m2.reportData.report.masterData?.actors||[]
      const actor1 = isNaN(src1)?a1.find(a=>a.name?.toLowerCase()===src1.toLowerCase()&&a.type==='Player'):a1.find(a=>a.id===parseInt(src1)&&a.type==='Player')
      const actor2 = isNaN(src2)?a2.find(a=>a.name?.toLowerCase()===src2.toLowerCase()&&a.type==='Player'):a2.find(a=>a.id===parseInt(src2)&&a.type==='Player')
      const name1=actor1?.name||src1; const name2=actor2?.name||src2
      const spec1=actor1?.subType||'Unknown'; const spec2=actor2?.subType||'Unknown'

      // Fetch raw events for both players
      setLoadStep(`Fetching all events for ${name1}...`)
      setStatus({type:'info',msg:`Fetching events for ${name1}...`})
      const raw1 = await fetchFullFightData({ reportCode:r1, fightStart:fight1.startTime, fightEnd:fight1.endTime, playerId:actor1?.id, setStep:setLoadStep })

      setLoadStep(`Fetching all events for ${name2}...`)
      setStatus({type:'info',msg:`Fetching events for ${name2}...`})
      const raw2 = await fetchFullFightData({ reportCode:r2, fightStart:fight2.startTime, fightEnd:fight2.endTime, playerId:actor2?.id, setStep:setLoadStep })

      // Fetch DPS table
      const [d1,d2,t1,t2] = await Promise.all([
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e,killType:Kills)}}}`,{c:r1,s:fight1.startTime,e:fight1.endTime}),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e,killType:Kills)}}}`,{c:r2,s:fight2.startTime,e:fight2.endTime}),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e,killType:Kills)}}}`,{c:r1,s:fight1.startTime,e:fight1.endTime}),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e,killType:Kills)}}}`,{c:r2,s:fight2.startTime,e:fight2.endTime}),
      ])
      const dmgE1=d1?.reportData?.report?.table?.data?.entries||[]
      const dmgE2=d2?.reportData?.report?.table?.data?.entries||[]
      const dur1=(fight1.endTime-fight1.startTime)/1000
      const dur2=(fight2.endTime-fight2.startTime)/1000
      const myDmg=dmgE1.find(e=>e.name?.toLowerCase()===name1.toLowerCase())
      const thDmg=dmgE2.find(e=>e.name?.toLowerCase()===name2.toLowerCase())
      const tkE1=t1?.reportData?.report?.table?.data?.entries||[]
      const tkE2=t2?.reportData?.report?.table?.data?.entries||[]

      // Resolve spell names
      setLoadStep('Resolving spell names...')
      const nameMap = {}
      collectNames([...raw1.casts,...raw1.buffs,...raw1.debuffs,...raw1.damage,...raw2.casts,...raw2.buffs,...raw2.debuffs,...raw2.damage], nameMap)
      const allIds = [...new Set([...[...raw1.casts,...raw2.casts].map(e=>e.abilityGameID)])]
      const resolvedNames = await resolveNames(allIds, nameMap)

      // Process both players
      setLoadStep('Analyzing game state...')
      setStatus({type:'info',msg:'Analyzing proc efficiency, sequences, and buff windows...'})

      const p1 = await processFightData({ raw:raw1, fightStart:fight1.startTime, fightEnd:fight1.endTime, playerId:actor1?.id, playerName:name1, spec:spec1, dps:myDmg?Math.round(myDmg.total/dur1):null, takenTotal:tkE1.find(e=>e.name?.toLowerCase()===name1.toLowerCase())?.total, nameMap:resolvedNames })
      const p2 = await processFightData({ raw:raw2, fightStart:fight2.startTime, fightEnd:fight2.endTime, playerId:actor2?.id, playerName:name2, spec:spec2, dps:thDmg?Math.round(thDmg.total/dur2):null, takenTotal:tkE2.find(e=>e.name?.toLowerCase()===name2.toLowerCase())?.total, nameMap:resolvedNames })

      // Build combined spell rows for display
      p1.boss = fight1.name; p2.boss = fight2.name
      const allSpellIds = new Set([...Object.keys(p1.spellMap),...Object.keys(p2.spellMap)])
      const rows = [...allSpellIds].map(id=>({
        id, name:p1.spellMap[id]?.name||p2.spellMap[id]?.name||resolvedNames[id]||`Spell ${id}`,
        ppm1:p1.spellMap[id]?.ppm||0, ppm2:p2.spellMap[id]?.ppm||0,
        count1:p1.spellMap[id]?.count||0, count2:p2.spellMap[id]?.count||0,
        first1:p1.spellMap[id]?.ts[0]??null, first2:p2.spellMap[id]?.ts[0]??null,
        ts1:p1.spellMap[id]?.ts||[], ts2:p2.spellMap[id]?.ts||[],
      })).sort((a,b)=>Math.max(b.ppm1,b.ppm2)-Math.max(a.ppm1,a.ppm2))

      // Attach spellRows to p1 for context building
      p1.spellRows = rows; p2.spellRows = rows

      setP1data(p1); setP2data(p2); setSpellRows(rows)
      setStatus({type:'ok',msg:`✓ Full analysis loaded — ${name1} (${spec1}) vs ${name2} (${spec2}) on ${fight1.name}`})

      // Fetch talents - run in background, resolve spell names from our nameMap
      setLoadStep('Fetching talent data...')
      Promise.all([
        fetchTalents({ reportCode: r1, fightId: f1id, fightStart: fight1.startTime, fightEnd: fight1.endTime, playerName: name1, playerId: actor1?.id, gql }),
        fetchTalents({ reportCode: r2, fightId: f2id, fightStart: fight2.startTime, fightEnd: fight2.endTime, playerName: name2, playerId: actor2?.id, gql }),
        fetchTalentTreeLayout(8, 64, gql),
      ]).then(([t1, t2, treeLayout]) => {
        function resolveTalentNames(talentData) {
          if (!talentData) return talentData
          return {
            ...talentData,
            talentTree: (talentData.talentTree || []).map(t => ({
              ...t,
              id: t.spellId || t.id,
              name: resolvedNames[t.spellId || t.id] || t.name || `Talent ${t.spellId || t.id}`,
            }))
          }
        }
        setTalentDiff({ t1: resolveTalentNames(t1), t2: resolveTalentNames(t2), name1, name2, treeLayout })
      }).catch(e => {
        console.warn('Talent fetch failed:', e)
        setTalentDiff({ t1: null, t2: null, name1, name2, treeLayout: null, error: e.message })
      })

      // Auto-analyze
      const ctx = buildRichContext(p1, p2, talentDiff)
      await runAI(
        `Analyze the fight data and respond in two parts:

**Part 1 — Priority Summary**
Give me a numbered list of the top 5 most impactful changes ${name1} should make, ordered by DPS impact. For each one, give a one-line description of what to change and why it matters. Keep this section tight — no more than 2 sentences per item.

**Part 2 — Full Analysis**
Go deep on each of the 5 items above. For each one:
- What exactly is happening in the data (with specific numbers and timestamps)
- The mechanical reason WHY it costs DPS
- Exactly WHEN and HOW to make the decision differently

Link every spell name to Wowhead using this format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)
Use the spell IDs from the data. Both players are ${spec1} spec.`,
        [], ctx
      )

    } catch(e) {
      setStatus({type:'err',msg:'Error: '+e.message})
      console.error(e)
    } finally {
      setLoading(false); setLoadStep('')
    }
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  async function runAI(userMsg, existingMessages, ctxOverride) {
    if (!p1data && !ctxOverride) return
    setAiLoading(true)
    const ctx = ctxOverride || buildRichContext(p1data, p2data, talentDiff)
    const newMessages = [...existingMessages, {role:'user',content:userMsg}]
    try {
      const reply = await callAI(newMessages, ctx)
      setMessages([...newMessages, {role:'assistant',content:reply}].slice(-20))
    } catch(e) {
      setMessages([...newMessages, {role:'assistant',content:'Error: '+e.message}])
    }
    setAiLoading(false)
  }

  function sendQuestion(q) {
    if (aiLoading||(!p1data&&!p2data)) return
    const msg = q||input.trim(); if (!msg) return
    setInput('')
    setMessages(prev=>[...prev,{role:'user',content:msg}])
    runAI(msg, messages)
  }

  function downloadData() {
    if (!p1data||!p2data) return
    const ctx = buildRichContext(p1data, p2data, talentDiff)
    const blob = new Blob([ctx],{type:'text/plain'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`parse-${p1data.name}-vs-${p2data.name}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  const dur1Fmt = p1data?`${Math.floor(p1data.dur/60)}:${String(Math.round(p1data.dur%60)).padStart(2,'0')}`:''
  const dur2Fmt = p2data?`${Math.floor(p2data.dur/60)}:${String(Math.round(p2data.dur%60)).padStart(2,'0')}`:''

  return (
    <>
      <Head><title>Parse Analyzer</title></Head>
      <div style={s.wrap}>
        <div style={s.hdr}>
          <div><div style={s.logo}>PARSE ANALYZER</div><div style={s.logoSub}>AI-Powered · Deep Fight Analysis</div></div>
          <span style={s.badge}>✦ Claude AI</span>
        </div>

        {/* AUTH */}
        {authStatus==='checking'&&<div style={s.panel}><div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'var(--dim)'}}>Checking WarcraftLogs connection...</div></div>}
        {authStatus==='needed'&&(
          <div style={s.panel}>
            <div style={s.ptitle}><div style={s.ptitleBar}/>Connect to WarcraftLogs</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:10}}>
              <div style={s.field}><label style={s.label}>WarcraftLogs Client ID</label><input style={s.input} value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" onKeyDown={e=>e.key==='Enter'&&startAuth()}/></div>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}><button style={s.btnGold} onClick={startAuth}>Authenticate</button></div>
            </div>
            {authMsg&&<div style={authMsg.type==='err'?s.alertErr:s.alertInfo}>{authMsg.msg}</div>}
            <div style={s.note}>Create a public client at <a href="https://www.warcraftlogs.com/api/clients" target="_blank" rel="noreferrer">warcraftlogs.com/api/clients</a> with redirect URL <code style={{background:'var(--bg4)',padding:'1px 5px',borderRadius:3,color:'var(--blue)'}}>http://localhost:3000/auth/callback</code> and Public Client checked.</div>
          </div>
        )}
        {authStatus==='ok'&&(
          <div style={{...s.panel,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 18px'}}>
            <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'var(--green)'}}>● WarcraftLogs connected</div>
            <button style={s.btnGhost} onClick={()=>setAuthStatus('needed')}>Reconnect</button>
          </div>
        )}

        {/* COMPARE URL */}
        <div style={s.panel}>
          <div style={s.ptitle}><div style={s.ptitleBar}/>Compare</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:10}}>
            <div style={s.field}>
              <label style={s.label}>WarcraftLogs Compare URL</label>
              <input style={s.input} value={compareUrl} onChange={e=>setCompareUrl(e.target.value)} placeholder="https://www.warcraftlogs.com/reports/compare/..." onKeyDown={e=>e.key==='Enter'&&!loading&&loadCompare()}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
              <button style={loading?s.btnGoldDis:s.btnGold} disabled={loading} onClick={loadCompare}>
                {loading?(loadStep||'Loading...'):'Load & Analyze'}
              </button>
            </div>
          </div>
          {status&&<div style={status.type==='err'?s.alertErr:status.type==='ok'?s.alertOk:s.alertInfo}>{status.msg}</div>}
        </div>

        {/* DATA CARDS */}
        {p1data&&p2data&&(
          <div style={s.panel}>
            <div style={{...s.ptitle,justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}><div style={s.ptitleBar}/>{bossName}</div>
              <button style={s.btnGhost} onClick={downloadData}>Download Data</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[
                {data:p1data,dur:dur1Fmt,color:'var(--gold2)',label:'you'},
                {data:p2data,dur:dur2Fmt,color:'var(--blue)',label:'comparison'},
              ].map((p,i)=>(
                <div key={i} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,padding:'10px 13px'}}>
                  <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:10,fontWeight:600,letterSpacing:'.8px',textTransform:'uppercase',color:p.color,marginBottom:4}}>{p.data.name} — {p.label}</div>
                  <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:22,fontWeight:700,color:p.color,lineHeight:1.2}}>{p.data.dps?.toLocaleString()||'?'} <span style={{fontSize:13,fontWeight:400,color:'var(--dim)'}}>dps</span></div>
                  <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'var(--dim)',marginTop:3}}>{p.dur} · {p.data.downtime.cpm}/min · {p.data.downtime.pct}% downtime · {p.data.spec}</div>
                  {/* Proc efficiency summary */}
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    {p.data.sequences.iceLance.total>0&&(
                      <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'var(--dim)',marginBottom:2}}>
                        IL w/ FoF: <span style={{color:p.color}}>{Math.round(p.data.sequences.iceLance.withFoF/p.data.sequences.iceLance.total*100)}%</span>
                        {' '}· BF combo: <span style={{color:p.color}}>{p.data.sequences.bfFlurry.total>0?Math.round(p.data.sequences.bfFlurry.withIceLance/p.data.sequences.bfFlurry.total*100)+'%':'—'}</span>
                        {' '}· Orbs: <span style={{color:p.color}}>{p.data.sequences.frozenOrb.casts.length}</span>
                      </div>
                    )}
                    {p.data.sequences.gsCombo.total>0&&(
                      <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'var(--dim)'}}>
                        GS clean: <span style={{color:p.color}}>{Math.round(p.data.sequences.gsCombo.clean/p.data.sequences.gsCombo.total*100)}%</span>
                        {' '}· IV casts: <span style={{color:p.color}}>{p.data.sequences.icyVeins.casts}</span>
                        {' '}· Alter Time: <span style={{color:p.color}}>{p.data.sequences.alterTime.casts.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Spell table */}
            <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:11,fontWeight:600,letterSpacing:'.8px',textTransform:'uppercase',color:'var(--dim)',marginBottom:6}}>Spell breakdown — casts/min</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead><tr>{['Spell',p1data.name,p2data.name,'Diff','First cast'].map((h,i)=>(
                  <th key={i} style={{fontFamily:'Rajdhani,sans-serif',fontSize:10,letterSpacing:'.8px',textTransform:'uppercase',color:i===1?'var(--gold2)':i===2?'var(--blue)':'var(--dim)',padding:'5px 8px',textAlign:i>0?'right':'left',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>
                ))}</tr></thead>
                <tbody>{spellRows.filter(r=>r.ppm1>0||r.ppm2>0).map((r,i)=>{
                  const diff=r.ppm2>0?Math.round((r.ppm1-r.ppm2)/r.ppm2*100):null
                  const dc=diff===null?'var(--dim)':diff>5?'var(--green)':diff<-5?'var(--red)':'var(--dim)'
                  const ft=r.first1!==null&&r.first2!==null&&Math.abs(r.first1-r.first2)>1.5
                  return(
                    <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'5px 8px',borderBottom:'1px solid var(--bg4)',fontFamily:'IBM Plex Mono,monospace',color:'var(--muted)'}}>
                        <a href={`https://www.wowhead.com/spell=${r.id}`} target="_blank" rel="noreferrer"
                          data-wh-spell={r.id} data-wh-name={r.name}
                          style={{color:'var(--muted)',textDecoration:'none',borderBottom:'1px dotted var(--dim)',cursor:'help'}}>
                          {r.name}
                        </a>
                      </td>
                      <td style={{padding:'5px 8px',borderBottom:'1px solid var(--bg4)',fontFamily:'IBM Plex Mono,monospace',color:'var(--gold2)',textAlign:'right'}}>{r.ppm1}</td>
                      <td style={{padding:'5px 8px',borderBottom:'1px solid var(--bg4)',fontFamily:'IBM Plex Mono,monospace',color:'var(--blue)',textAlign:'right'}}>{r.ppm2}</td>
                      <td style={{padding:'5px 8px',borderBottom:'1px solid var(--bg4)',fontFamily:'IBM Plex Mono,monospace',color:dc,textAlign:'right'}}>{diff===null?'—':(diff>=0?'+':'')+diff+'%'}</td>
                      <td style={{padding:'5px 8px',borderBottom:'1px solid var(--bg4)',fontSize:11}}>{ft&&<><span style={{color:'var(--gold2)'}}>{r.first1}s</span> vs <span style={{color:'var(--blue)'}}>{r.first2}s</span></>}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHARTS */}
        {p1data&&p2data&&(
          <div style={s.panel}>
            <div style={s.ptitle}><div style={s.ptitleBar}/>Charts</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <ChartCard title="Spell usage — casts/min" height={240}>
                <SpellUsageChart spellRows={spellRows} name1={p1data.name} name2={p2data.name}/>
              </ChartCard>
              <ChartCard title="Cast rate over time (30s windows)" height={240}>
                <CastTimelineChart p1data={p1data} p2data={p2data}/>
              </ChartCard>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ChartCard title="Proc efficiency %" height={200}>
                <ProcEfficiencyChart p1data={p1data} p2data={p2data}/>
              </ChartCard>
              <ChartCard title="Cooldown timeline" height={200}>
                <CooldownTimelineChart p1data={p1data} p2data={p2data} spellRows={spellRows}/>
              </ChartCard>
            </div>
          </div>
        )}

        {/* TALENT COMPARE */}
        {talentDiff && (
          <div style={s.panel}>
            <div style={s.ptitle}><div style={s.ptitleBar}/>Talent Comparison</div>
            {talentDiff.error && !talentDiff.t1 && !talentDiff.t2
              ? <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:12,color:'var(--dim)'}}>Could not load talent data: {talentDiff.error}</div>
              : <TalentCompare p1Talents={talentDiff.t1} p2Talents={talentDiff.t2} name1={talentDiff.name1} name2={talentDiff.name2} treeLayout={talentDiff.treeLayout}/>
            }
          </div>
        )}

        {/* CHAT */}
        {p1data&&p2data&&(
          <div style={s.panel}>
            <div style={{...s.ptitle,justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}><div style={s.ptitleBar}/>Ask Claude</div>
              {messages.length>0&&(
                <CopyBtn text={messages.map(m=>`${m.role==='user'?'You':'Claude'}:\n${m.content}`).join('\n\n---\n\n')} label="Copy All"/>
              )}
            </div>

            {/* Chat feed — scrolls to bottom on new message */}
            <div ref={chatRef} style={{display:'flex',flexDirection:'column',maxHeight:560,overflowY:'auto',marginBottom:12,paddingRight:4}}>
              {messages.map((m,i)=>{
                const isLastUser = m.role==='user' && messages.slice(i+1).every(x=>x.role!=='user')
                return (
                <div key={i} ref={isLastUser ? lastUserMsgRef : null} style={{marginBottom:m.role==='user'?8:12}}>
                  {m.role==='user'
                    ? <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'6px 6px 2px 6px',padding:'8px 12px',fontSize:12,color:'var(--muted)',alignSelf:'flex-end',maxWidth:'74%',marginLeft:'auto'}}>{m.content}</div>
                    : <div style={{position:'relative'}}>
                        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'2px 6px 6px 6px',padding:'13px 15px 32px 15px',fontSize:13,lineHeight:1.85}}>
                          <FormatAI text={m.content}/>
                        </div>
                        <div style={{position:'absolute',bottom:8,right:10}}>
                          <CopyBtn text={m.content} label="Copy"/>
                        </div>
                      </div>
                  }
                </div>
                )
              })}
              {aiLoading&&(
                <div style={{display:'flex',alignItems:'center',gap:4,padding:'12px 15px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'2px 6px 6px 6px',marginBottom:10}}>
                  {[0,200,400].map(d=><div key={d} style={{width:5,height:5,borderRadius:'50%',background:'var(--dim)',animation:`td 1.2s ${d}ms infinite`}}/>)}
                  <span style={{fontSize:11,color:'var(--dim)',fontFamily:'IBM Plex Mono,monospace',marginLeft:6}}>Analyzing...</span>
                </div>
              )}
              {/* Scroll anchor */}
              <div ref={scrollAnchorRef}/>
            </div>

            <div style={{fontSize:11,color:'var(--dim)',fontFamily:'IBM Plex Mono,monospace',marginBottom:6}}>Quick questions:</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:10}}>
              {PRESET_QUESTIONS.map((q,i)=>(
                <button key={i} onClick={()=>sendQuestion(q)} disabled={aiLoading}
                  style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,padding:'7px 10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:3,color:'var(--muted)',cursor:aiLoading?'not-allowed':'pointer',textAlign:'left',lineHeight:1.4}}
                  onMouseEnter={e=>{if(!aiLoading){e.target.style.borderColor='var(--golddim)';e.target.style.color='var(--gold)'}}}
                  onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--muted)'}}>
                  {q}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <input style={s.input} value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask anything — why am I losing DPS, when should I hold cooldowns, etc." onKeyDown={e=>e.key==='Enter'&&sendQuestion()} disabled={aiLoading}/>
              <button style={aiLoading?s.btnGoldDis:s.btnGold} onClick={()=>sendQuestion()} disabled={aiLoading}>Ask</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}} input:focus{border-color:var(--golddim)!important;outline:none;}`}</style>
    </>
  )
}
