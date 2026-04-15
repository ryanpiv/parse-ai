import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { FightPlayerRow } from '../lib/wclFightPlayers'
import { fetchFightPlayerRows } from '../lib/wclFightPlayers'
import { parseWclUrl, resolveReportFightQuery } from '../lib/wclReportUrl'
import { useAppSession } from './AppSessionContext'
import { useAnalyzePageCache } from './AnalyzePageCacheContext'
import { gql, callAI } from '../lib/wclClient'
import {
  collectNames,
  resolveNames,
  fetchFullFightData,
  processFightData,
  createSoloAnalysisPartnerStub,
} from '../lib/fightAnalysis'
import type { AnalyzedFightData } from '../lib/fightAnalysis'
import { genVerifier, genChallenge } from '../lib/pkce'
import { buildRichContext, buildRichContextPlayerOne } from '../lib/buildContext'
import { simcAplAvailableForSpec } from '../lib/knowledge/embeddedSimc'
import { fetchTalents } from '../lib/talents'
import { talentDataToP1RowsJson } from '../lib/talents/p1TalentTreeSession'

export type FightSpellRow = {
  id: string
  name: string
  ppm1: number
  ppm2: number
  count1: number
  count2: number
  first1: number | null
  first2: number | null
  ts1: number[]
  ts2: number[]
}

export type TalentDiffState = {
  t1: any
  t2: any
  name1: string
  name2: string
  specId?: number
  error?: string
}

type FightMeta = {
  id: number
  name: string
  startTime: number
  endTime: number
  kill: boolean
}

type ChatMsg = { role: string; content: string }

export type AnalysisSubtab = 'solo' | 'compare'

type FightAnalysisCtx = {
  compareUrl: string
  setCompareUrl: (v: string) => void
  status: { type: string; msg: string } | null
  loading: boolean
  loadStep: string
  loadCompare: () => Promise<void>
  p1data: AnalyzedFightData | null
  p2data: AnalyzedFightData | null
  spellRows: FightSpellRow[]
  talentDiff: TalentDiffState | null
  messagesCompare: ChatMsg[]
  messagesAnalyze: ChatMsg[]
  inputCompare: string
  setInputCompare: (v: string) => void
  inputAnalyze: string
  setInputAnalyze: (v: string) => void
  aiLoading: boolean
  simcCompareEnabled: boolean
  setSimcCompareEnabled: (v: boolean) => void
  bossName: string
  fightKill1: boolean
  fightKill2: boolean
  authStatus: 'checking' | 'ok' | 'needed'
  clientId: string
  setClientId: (v: string) => void
  authMsg: { type: string; msg: string } | null
  startAuth: () => Promise<void>
  setAuthStatus: (v: 'checking' | 'ok' | 'needed') => void
  sendCompareQuestion: (q?: string) => void
  sendAnalyzeQuestion: (q?: string) => void
  buildContextCompare: () => string
  buildContextPlayerOne: () => string
  downloadDataCompare: () => void
  analysisSubtab: AnalysisSubtab
  setAnalysisSubtab: (v: AnalysisSubtab) => void
  /** Loaded from a single /reports/<code> URL (Compare vs partner is unavailable). */
  soloFromReport: boolean
  /** When a report has several characters and no `source=`, pick one here. */
  soloPlayerChoices: FightPlayerRow[]
  /** Which roster id is loaded (solo report); used to highlight the active chip while the roster stays open. */
  soloRosterSelectedPlayerId: number | null
  confirmSoloReportPlayer: (sourceToken: string) => Promise<void>
}

const FightAnalysisContext = createContext<FightAnalysisCtx | null>(null)

export function FightAnalysisProvider({ children }: { children: ReactNode }) {
  const analyzeCache = useAnalyzePageCache()
  const { hydrated, session, patchSession } = useAppSession()

  const [compareUrl, setCompareUrl] = useState('')
  const [status, setStatus] = useState<{ type: string; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadStep, setLoadStep] = useState('')
  const [p1data, setP1data] = useState<AnalyzedFightData | null>(null)
  const [p2data, setP2data] = useState<AnalyzedFightData | null>(null)
  const [spellRows, setSpellRows] = useState<FightSpellRow[]>([])
  const [talentDiff, setTalentDiff] = useState<TalentDiffState | null>(null)
  const [messagesCompare, setMessagesCompare] = useState<ChatMsg[]>([])
  const [messagesAnalyze, setMessagesAnalyze] = useState<ChatMsg[]>([])
  const [inputCompare, setInputCompare] = useState('')
  const [inputAnalyze, setInputAnalyze] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [bossName, setBossName] = useState('')
  const [fightKill1, setFightKill1] = useState(true)
  const [fightKill2, setFightKill2] = useState(true)
  const [simcCompareEnabled, setSimcCompareEnabled] = useState(false)
  const [analysisSubtab, setAnalysisSubtab] = useState<AnalysisSubtab>('solo')
  const [soloFromReport, setSoloFromReport] = useState(false)
  const [soloPlayerChoices, setSoloPlayerChoices] = useState<FightPlayerRow[]>([])
  const [soloRosterSelectedPlayerId, setSoloRosterSelectedPlayerId] = useState<number | null>(null)

  const [authStatus, setAuthStatus] = useState<'checking' | 'ok' | 'needed'>('checking')
  const [clientId, setClientId] = useState('')
  const [authMsg, setAuthMsg] = useState<{ type: string; msg: string } | null>(null)

  const compareUrlRestoredRef = useRef(false)
  const executeSoloReportFullRef = useRef<(code: string, fightId: number, srcRaw: string) => Promise<void>>(
    async () => {}
  )
  const analyzeFlushRef = useRef({
    compareUrl,
    status,
    loadStep,
    p1data,
    p2data,
    spellRows,
    talentDiff,
    messagesCompare,
    messagesAnalyze,
    bossName,
    fightKill1,
    fightKill2,
    simcCompareEnabled,
    analysisSubtab,
    loading,
    soloFromReport,
  })
  analyzeFlushRef.current = {
    compareUrl,
    status,
    loadStep,
    p1data,
    p2data,
    spellRows,
    talentDiff,
    messagesCompare,
    messagesAnalyze,
    bossName,
    fightKill1,
    fightKill2,
    simcCompareEnabled,
    analysisSubtab,
    loading,
    soloFromReport,
  }

  useLayoutEffect(() => {
    const s = analyzeCache.read()
    if (!s?.p1data || !s?.p2data) return
    compareUrlRestoredRef.current = true
    setCompareUrl(s.compareUrl)
    setStatus(s.status)
    setLoadStep(s.loadStep)
    setP1data(s.p1data)
    setP2data(s.p2data)
    setSpellRows(s.spellRows as FightSpellRow[])
    setTalentDiff(s.talentDiff as TalentDiffState | null)
    const legacy = s.messages
    setMessagesCompare(s.messagesCompare ?? legacy ?? [])
    setMessagesAnalyze(s.messagesAnalyze ?? [])
    setBossName(s.bossName || '')
    setFightKill1(s.fightKill1 ?? true)
    setFightKill2(s.fightKill2 ?? true)
    setSimcCompareEnabled(s.simcCompareEnabled ?? false)
    setSoloFromReport(Boolean(s.soloFromReport))
    if (s.analysisSubtab === 'compare' || s.analysisSubtab === 'solo') {
      setAnalysisSubtab(s.analysisSubtab)
    }
  }, [analyzeCache])

  useLayoutEffect(() => {
    const ac = analyzeCache
    return () => {
      const snap = analyzeFlushRef.current
      if (snap.loading && !snap.p1data && !snap.p2data) return
      ac.save({
        compareUrl: snap.compareUrl,
        status: snap.status,
        loadStep: snap.loadStep,
        p1data: snap.p1data,
        p2data: snap.p2data,
        spellRows: snap.spellRows,
        talentDiff: snap.talentDiff,
        messagesCompare: snap.messagesCompare,
        messagesAnalyze: snap.messagesAnalyze,
        bossName: snap.bossName,
        fightKill1: snap.fightKill1,
        fightKill2: snap.fightKill2,
        simcCompareEnabled: snap.simcCompareEnabled,
        analysisSubtab: snap.analysisSubtab,
        soloFromReport: snap.soloFromReport,
      })
    }
  }, [analyzeCache])

  useEffect(() => {
    if (loading) return
    analyzeCache.save({
      compareUrl,
      status,
      loadStep,
      p1data,
      p2data,
      spellRows,
      talentDiff,
      messagesCompare,
      messagesAnalyze,
      bossName,
      fightKill1,
      fightKill2,
      simcCompareEnabled,
      analysisSubtab,
      soloFromReport,
    })
  }, [
    loading,
    compareUrl,
    status,
    loadStep,
    p1data,
    p2data,
    spellRows,
    talentDiff,
    messagesCompare,
    messagesAnalyze,
    bossName,
    fightKill1,
    fightKill2,
    simcCompareEnabled,
    analysisSubtab,
    soloFromReport,
    analyzeCache,
  ])

  useEffect(() => {
    fetch('/api/auth')
      .then(r => r.json())
      .then(d => setAuthStatus(d.authenticated ? 'ok' : 'needed'))
      .catch(() => setAuthStatus('needed'))
  }, [])

  useEffect(() => {
    if (!hydrated || compareUrlRestoredRef.current) return
    compareUrlRestoredRef.current = true
    if (session.wclCompareUrl) setCompareUrl(session.wclCompareUrl)
  }, [hydrated, session.wclCompareUrl])

  useEffect(() => {
    if (!simcAplAvailableForSpec(talentDiff?.specId)) setSimcCompareEnabled(false)
  }, [talentDiff?.specId])

  useEffect(() => {
    if (analysisSubtab === 'compare' && (!p1data || !p2data || soloFromReport)) setAnalysisSubtab('solo')
  }, [analysisSubtab, p1data, p2data, soloFromReport])

  const startAuth = useCallback(async () => {
    if (!clientId.trim()) {
      setAuthMsg({ type: 'err', msg: 'Enter your WCL Client ID.' })
      return
    }
    sessionStorage.setItem('wcl_client_id', clientId.trim())
    const verifier = genVerifier()
    const state = Math.random().toString(36).slice(2)
    const challenge = await genChallenge(verifier)
    sessionStorage.setItem('wcl_pkce_verifier', verifier)
    sessionStorage.setItem('wcl_pkce_state', state)
    window.location.href = `https://www.warcraftlogs.com/oauth/authorize?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent('http://localhost:3000/auth/callback')}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`
  }, [clientId])

  const buildContextCompare = useCallback(() => {
    if (!p1data || !p2data) return ''
    const useSimc = simcCompareEnabled && simcAplAvailableForSpec(talentDiff?.specId)
    return buildRichContext(p1data, p2data, talentDiff, {
      isKill1: fightKill1,
      isKill2: fightKill2,
      simcGroundedAnalysis: useSimc,
    })
  }, [p1data, p2data, talentDiff, fightKill1, fightKill2, simcCompareEnabled])

  const buildContextPlayerOneCb = useCallback(() => {
    if (!p1data) return ''
    const useSimc = simcCompareEnabled && simcAplAvailableForSpec(talentDiff?.specId)
    return buildRichContextPlayerOne(p1data, talentDiff, {
      isKill1: fightKill1,
      simcGroundedAnalysis: useSimc,
    })
  }, [p1data, talentDiff, fightKill1, simcCompareEnabled])

  const runAI = useCallback(
    async (userMsg: string, priorThread: ChatMsg[], ctxOverride: string | undefined, channel: 'compare' | 'analyze') => {
      if (channel === 'compare') {
        if (!ctxOverride && (!p1data || !p2data || soloFromReport)) return
      } else {
        if (!ctxOverride && !p1data) return
      }

      const newMessages = [...priorThread, { role: 'user', content: userMsg }]
      const setMsgs = channel === 'compare' ? setMessagesCompare : setMessagesAnalyze
      setMsgs(newMessages)
      setAiLoading(true)
      const ctx =
        ctxOverride ??
        (channel === 'compare' ? buildContextCompare() : buildContextPlayerOneCb())
      try {
        const reply = await callAI(newMessages, ctx)
        setMsgs([...newMessages, { role: 'assistant', content: reply }].slice(-20))
      } catch (e: any) {
        setMsgs([...newMessages, { role: 'assistant', content: 'Error: ' + e.message }])
      }
      setAiLoading(false)
    },
    [p1data, p2data, soloFromReport, buildContextCompare, buildContextPlayerOneCb]
  )

  const sendCompareQuestion = useCallback(
    (q?: string) => {
      if (aiLoading || !p1data || !p2data || soloFromReport) return
      const msg = q ?? inputCompare.trim()
      if (!msg) return
      setInputCompare('')
      void runAI(msg, messagesCompare, undefined, 'compare')
    },
    [aiLoading, p1data, p2data, soloFromReport, inputCompare, messagesCompare, runAI]
  )

  const sendAnalyzeQuestion = useCallback(
    (q?: string) => {
      if (aiLoading || !p1data) return
      const msg = q ?? inputAnalyze.trim()
      if (!msg) return
      setInputAnalyze('')
      void runAI(msg, messagesAnalyze, undefined, 'analyze')
    },
    [aiLoading, p1data, inputAnalyze, messagesAnalyze, runAI]
  )

  const downloadDataCompare = useCallback(() => {
    if (!p1data || !p2data || soloFromReport) return
    const ctx = buildContextCompare()
    const blob = new Blob([ctx], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parse-${p1data.name}-vs-${p2data.name}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [p1data, p2data, soloFromReport, buildContextCompare])

  executeSoloReportFullRef.current = async (code: string, fightId: number, srcRaw: string) => {
    setSoloFromReport(true)
    setLoadStep('Fetching report metadata...')
    setStatus({ type: 'info', msg: 'Fetching report metadata...' })

    const m1 = await gql(
      `query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`,
      { c: code }
    )
    if (!(m1 as any).reportData?.report) throw new Error('Report not found or inaccessible.')
    const fight1 = (m1 as any).reportData.report.fights.find((f: FightMeta) => f.id === fightId)
    if (!fight1) {
      const ids = (m1 as any).reportData.report.fights.map((f: FightMeta) => f.id).join(', ')
      throw new Error(`Fight ${fightId} not found. Available fight IDs: ${ids}`)
    }

    const isKill1 = fight1.kill === true
    setFightKill1(isKill1)
    setFightKill2(true)
    setBossName(fight1.name)

    if (!isKill1) {
      setStatus({ type: 'info', msg: `⚠ ${fight1.name} is a wipe — loading anyway` })
    }

    const a1 = (m1 as any).reportData.report.masterData?.actors || []
    const srcTrim = String(srcRaw).trim()
    const actor1 = isNaN(Number(srcTrim))
      ? a1.find((a: any) => a.name?.toLowerCase() === srcTrim.toLowerCase() && a.type === 'Player')
      : a1.find((a: any) => a.id === parseInt(srcTrim, 10) && a.type === 'Player') ||
        a1.find((a: any) => a.id === parseInt(srcTrim, 10))

    const pid = actor1?.id
    if (pid == null || Number.isNaN(Number(pid))) {
      throw new Error(`Could not find player "${srcRaw}" in this fight. Use a name or numeric source id from Warcraft Logs.`)
    }
    const name1 = actor1?.name || srcTrim
    const spec1 = actor1?.subType || 'Unknown'

    setLoadStep(`Fetching all events for ${name1}...`)
    setStatus({ type: 'info', msg: `Fetching events for ${name1}...` })
    const raw1 = await fetchFullFightData({
      reportCode: code,
      fightStart: fight1.startTime,
      fightEnd: fight1.endTime,
      playerId: Number(pid),
      setStep: setLoadStep,
    })

    const [d1, t1] = await Promise.all([
      gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`, {
        c: code,
        s: fight1.startTime,
        e: fight1.endTime,
      }),
      gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e)}}}`, {
        c: code,
        s: fight1.startTime,
        e: fight1.endTime,
      }),
    ])

    const dmgE1 = (d1 as any)?.reportData?.report?.table?.data?.entries || []
    const dur1 = (fight1.endTime - fight1.startTime) / 1000
    const myDmg = dmgE1.find((e: any) => e.name?.toLowerCase() === name1.toLowerCase())
    const tkE1 = (t1 as any)?.reportData?.report?.table?.data?.entries || []

    setLoadStep('Resolving spell names...')
    const nameMap: Record<number, string> = {}
    collectNames([...raw1.casts, ...raw1.buffs, ...raw1.debuffs, ...raw1.damage], nameMap)
    const allIds = [...new Set(raw1.casts.map((e: any) => e.abilityGameID).filter(Boolean))]
    const resolvedNames = await resolveNames(allIds, nameMap)

    setLoadStep('Analyzing game state...')
    setStatus({ type: 'info', msg: 'Analyzing buff windows and cast data...' })

    const p1 = await processFightData({
      raw: raw1,
      fightStart: fight1.startTime,
      fightEnd: fight1.endTime,
      playerId: Number(pid),
      playerName: name1,
      spec: spec1,
      dps: myDmg ? Math.round(myDmg.total / dur1) : null,
      takenTotal: tkE1.find((e: any) => e.name?.toLowerCase() === name1.toLowerCase())?.total,
      nameMap: resolvedNames,
    })
    ;(p1 as any).isKill = isKill1
    p1.boss = fight1.name

    const pStub = createSoloAnalysisPartnerStub(p1)

    const allSpellIds = new Set([...Object.keys(p1.spellMap)])
    const rows: FightSpellRow[] = [...allSpellIds]
      .map(id => ({
        id,
        name: p1.spellMap[id]?.name || resolvedNames[Number(id)] || `Spell ${id}`,
        ppm1: p1.spellMap[id]?.ppm || 0,
        ppm2: 0,
        count1: p1.spellMap[id]?.count || 0,
        count2: 0,
        first1: p1.spellMap[id]?.ts[0] ?? null,
        first2: null,
        ts1: p1.spellMap[id]?.ts || [],
        ts2: [],
      }))
      .sort((a, b) => b.ppm1 - a.ppm1)

    p1.spellRows = rows
    pStub.spellRows = rows
    setP1data(p1)
    setP2data(pStub)
    setSpellRows(rows)
    setSoloRosterSelectedPlayerId(Number(pid))

    const wipeWarning = !isKill1 ? ` ⚠ ${name1}: wipe` : ''
    setStatus({
      type: 'ok',
      msg: `✓ Loaded solo — ${name1} (${spec1}) on ${fight1.name}${wipeWarning}`,
    })
    setMessagesCompare([])

    setLoadStep('Fetching talent data...')
    let talentDiffResolved: TalentDiffState | null = null
    try {
      const tt1 = await fetchTalents({
        reportCode: code,
        fightId,
        fightStart: fight1.startTime,
        fightEnd: fight1.endTime,
        playerName: name1,
        playerId: Number(pid),
        gql,
      })
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
      const specId = tt1?.specID || undefined
      talentDiffResolved = {
        t1: resolveTalentNames(tt1),
        t2: null,
        name1,
        name2: '\u2014',
        specId,
      }
      setTalentDiff(talentDiffResolved)
      patchSession({
        compareStr1: typeof tt1?.talentString === 'string' ? tt1.talentString : '',
        compareStr2: '',
        compareName1: name1,
        compareName2: '',
        specId: specId ?? null,
        p1TalentTreeJson: talentDataToP1RowsJson(tt1?.talentTree?.length ? tt1.talentTree : tt1?.talents),
      })
    } catch (e: any) {
      console.warn('Talent fetch failed:', e)
      talentDiffResolved = { t1: null, t2: null, name1, name2: '\u2014', error: e.message }
      setTalentDiff(talentDiffResolved)
    }
  }

  const confirmSoloReportPlayer = useCallback(
    async (sourceToken: string) => {
      if (!compareUrl.trim()) return
      let parsed: ReturnType<typeof parseWclUrl>
      try {
        parsed = parseWclUrl(compareUrl.trim())
      } catch {
        return
      }
      if (parsed.kind !== 'report') return
      const pickedId = parseInt(sourceToken.trim(), 10)
      if (!Number.isNaN(pickedId)) setSoloRosterSelectedPlayerId(pickedId)
      setLoading(true)
      setP1data(null)
      setP2data(null)
      setTalentDiff(null)
      setMessagesCompare([])
      setMessagesAnalyze([])
      setSoloFromReport(false)
      setLoadStep('Loading fight…')
      setStatus({ type: 'info', msg: 'Loading fight…' })
      try {
        const m1Resolve = await gql(
          `query($c:String!){reportData{report(code:$c){fights{id startTime endTime}}}}`,
          { c: parsed.code }
        )
        const fightsResolve = (m1Resolve as any).reportData?.report?.fights || []
        const fightIdResolved = resolveReportFightQuery(fightsResolve, parsed.fightQuery)
        await executeSoloReportFullRef.current(parsed.code, fightIdResolved, sourceToken)
      } catch (e: any) {
        setStatus({ type: 'err', msg: 'Error: ' + e.message })
        console.error(e)
        setSoloRosterSelectedPlayerId(null)
      } finally {
        setLoading(false)
        setLoadStep('')
      }
    },
    [compareUrl]
  )

  const loadCompare = useCallback(async () => {
    if (!compareUrl.trim()) {
      setStatus({ type: 'err', msg: 'Paste a Warcraft Logs report or compare URL.' })
      return
    }

    let parsed: ReturnType<typeof parseWclUrl>
    try {
      parsed = parseWclUrl(compareUrl.trim())
    } catch (e: any) {
      setStatus({ type: 'err', msg: e.message || 'Could not parse URL.' })
      return
    }

    patchSession({ wclCompareUrl: compareUrl.trim() })

    setLoading(true)
    setP1data(null)
    setP2data(null)
    setTalentDiff(null)
    setMessagesCompare([])
    setMessagesAnalyze([])
    setSoloPlayerChoices([])
    setSoloRosterSelectedPlayerId(null)

    try {
      setLoadStep('Fetching report metadata...')
      setStatus({ type: 'info', msg: 'Fetching report metadata...' })

      if (parsed.kind === 'report') {
        setSoloFromReport(false)
        const { code, fightQuery, source } = parsed

        const m1 = await gql(
          `query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`,
          { c: code }
        )
        if (!(m1 as any).reportData?.report) throw new Error('Report not found or inaccessible.')
        const fights = (m1 as any).reportData.report.fights || []
        const fightId = resolveReportFightQuery(fights, fightQuery)
        const fight1 = fights.find((f: FightMeta) => f.id === fightId)
        if (!fight1) {
          const ids = fights.map((f: FightMeta) => f.id).join(', ')
          throw new Error(`Fight ${fightId} not found. Available fight IDs: ${ids}`)
        }

        let srcToUse = source.trim()
        if (!srcToUse) {
          const players = await fetchFightPlayerRows(gql, code, fightId, {
            startTime: fight1.startTime,
            endTime: fight1.endTime,
          })
          if (!players.length) {
            throw new Error(
              'No player roster found for this fight (WCL returned no playerDetails and no damage/healing rankings for the fight window). Try ?source= with a player id from the log.',
            )
          }
          if (players.length > 1) {
            setSoloPlayerChoices(players)
            setStatus({
              type: 'info',
              msg: 'Several characters were in this fight. Choose one below for solo analysis.',
            })
            return
          }
          srcToUse = String(players[0].id)
        }

        await executeSoloReportFullRef.current(code, fightId, srcToUse)
        return
      }

      setSoloFromReport(false)
      const { r1, r2, f1id, f2id, src1, src2 } = parsed

      const [m1, m2] = await Promise.all([
        gql(`query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`, { c: r1 }),
        gql(`query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`, { c: r2 }),
      ])

      const fight1 = (m1 as any).reportData.report.fights.find((f: FightMeta) => f.id === f1id)
      const fight2 = (m2 as any).reportData.report.fights.find((f: FightMeta) => f.id === f2id)
      if (!fight1)
        throw new Error(
          `Fight ${f1id} not found in report ${r1}. Available fight IDs: ${(m1 as any).reportData.report.fights.map((f: FightMeta) => f.id).join(', ')}`
        )
      if (!fight2)
        throw new Error(
          `Fight ${f2id} not found in report ${r2}. Available fight IDs: ${(m2 as any).reportData.report.fights.map((f: FightMeta) => f.id).join(', ')}`
        )

      const isKill1 = fight1.kill === true
      const isKill2 = fight2.kill === true
      setFightKill1(isKill1)
      setFightKill2(isKill2)
      setBossName(fight1.name)

      if (!isKill1 || !isKill2) {
        const wipeNote = [!isKill1 && `${fight1.name} fight 1 is a wipe`, !isKill2 && `${fight2.name} fight 2 is a wipe`]
          .filter(Boolean)
          .join(', ')
        setStatus({ type: 'info', msg: `⚠ ${wipeNote} — loading anyway` })
      }

      const a1 = (m1 as any).reportData.report.masterData?.actors || []
      const a2 = (m2 as any).reportData.report.masterData?.actors || []
      const actor1 = isNaN(Number(src1))
        ? a1.find((a: any) => a.name?.toLowerCase() === src1.toLowerCase() && a.type === 'Player')
        : a1.find((a: any) => a.id === parseInt(src1) && a.type === 'Player')
      const actor2 = isNaN(Number(src2))
        ? a2.find((a: any) => a.name?.toLowerCase() === src2.toLowerCase() && a.type === 'Player')
        : a2.find((a: any) => a.id === parseInt(src2) && a.type === 'Player')
      const name1 = actor1?.name || src1
      const name2 = actor2?.name || src2
      const spec1 = actor1?.subType || 'Unknown'
      const spec2 = actor2?.subType || 'Unknown'

      setLoadStep(`Fetching all events for ${name1}...`)
      setStatus({ type: 'info', msg: `Fetching events for ${name1}...` })
      const raw1 = await fetchFullFightData({
        reportCode: r1,
        fightStart: fight1.startTime,
        fightEnd: fight1.endTime,
        playerId: actor1?.id,
        setStep: setLoadStep,
      })

      setLoadStep(`Fetching all events for ${name2}...`)
      setStatus({ type: 'info', msg: `Fetching events for ${name2}...` })
      const raw2 = await fetchFullFightData({
        reportCode: r2,
        fightStart: fight2.startTime,
        fightEnd: fight2.endTime,
        playerId: actor2?.id,
        setStep: setLoadStep,
      })

      const [d1, d2, t1, t2] = await Promise.all([
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`, {
          c: r1,
          s: fight1.startTime,
          e: fight1.endTime,
        }),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`, {
          c: r2,
          s: fight2.startTime,
          e: fight2.endTime,
        }),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e)}}}`, {
          c: r1,
          s: fight1.startTime,
          e: fight1.endTime,
        }),
        gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageTaken,startTime:$s,endTime:$e)}}}`, {
          c: r2,
          s: fight2.startTime,
          e: fight2.endTime,
        }),
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
      collectNames(
        [...raw1.casts, ...raw1.buffs, ...raw1.debuffs, ...raw1.damage, ...raw2.casts, ...raw2.buffs, ...raw2.debuffs, ...raw2.damage],
        nameMap
      )
      const allIds = [...new Set([...raw1.casts, ...raw2.casts].map((e: any) => e.abilityGameID))]
      const resolvedNames = await resolveNames(allIds, nameMap)

      setLoadStep('Analyzing game state...')
      setStatus({ type: 'info', msg: 'Analyzing buff windows and cast data...' })

      const p1 = await processFightData({
        raw: raw1,
        fightStart: fight1.startTime,
        fightEnd: fight1.endTime,
        playerId: actor1?.id,
        playerName: name1,
        spec: spec1,
        dps: myDmg ? Math.round(myDmg.total / dur1) : null,
        takenTotal: tkE1.find((e: any) => e.name?.toLowerCase() === name1.toLowerCase())?.total,
        nameMap: resolvedNames,
      })
      const p2 = await processFightData({
        raw: raw2,
        fightStart: fight2.startTime,
        fightEnd: fight2.endTime,
        playerId: actor2?.id,
        playerName: name2,
        spec: spec2,
        dps: thDmg ? Math.round(thDmg.total / dur2) : null,
        takenTotal: tkE2.find((e: any) => e.name?.toLowerCase() === name2.toLowerCase())?.total,
        nameMap: resolvedNames,
      })

      ;(p1 as any).isKill = isKill1
      ;(p2 as any).isKill = isKill2

      p1.boss = fight1.name
      p2.boss = fight2.name
      const allSpellIds = new Set([...Object.keys(p1.spellMap), ...Object.keys(p2.spellMap)])
      const rows: FightSpellRow[] = [...allSpellIds].map(id => ({
        id,
        name: p1.spellMap[id]?.name || p2.spellMap[id]?.name || resolvedNames[Number(id)] || `Spell ${id}`,
        ppm1: p1.spellMap[id]?.ppm || 0,
        ppm2: p2.spellMap[id]?.ppm || 0,
        count1: p1.spellMap[id]?.count || 0,
        count2: p2.spellMap[id]?.count || 0,
        first1: p1.spellMap[id]?.ts[0] ?? null,
        first2: p2.spellMap[id]?.ts[0] ?? null,
        ts1: p1.spellMap[id]?.ts || [],
        ts2: p2.spellMap[id]?.ts || [],
      })).sort((a, b) => Math.max(b.ppm1, b.ppm2) - Math.max(a.ppm1, a.ppm2))

      p1.spellRows = rows
      p2.spellRows = rows
      setP1data(p1)
      setP2data(p2)
      setSpellRows(rows)

      const wipeWarning =
        !isKill1 || !isKill2
          ? ` ⚠ ${[!isKill1 && `${name1}: wipe`, !isKill2 && `${name2}: wipe`].filter(Boolean).join(' · ')}`
          : ''
      setStatus({
        type: 'ok',
        msg: `✓ Loaded — ${name1} (${spec1}) vs ${name2} (${spec2}) on ${fight1.name}${wipeWarning}`,
      })

      setLoadStep('Fetching talent data...')
      let talentDiffResolved: TalentDiffState | null = null
      try {
        const [tt1, tt2] = await Promise.all([
          fetchTalents({
            reportCode: r1,
            fightId: f1id,
            fightStart: fight1.startTime,
            fightEnd: fight1.endTime,
            playerName: name1,
            playerId: actor1?.id,
            gql,
          }),
          fetchTalents({
            reportCode: r2,
            fightId: f2id,
            fightStart: fight2.startTime,
            fightEnd: fight2.endTime,
            playerName: name2,
            playerId: actor2?.id,
            gql,
          }),
        ])
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
        talentDiffResolved = { t1: resolveTalentNames(tt1), t2: resolveTalentNames(tt2), name1, name2, specId }
        setTalentDiff(talentDiffResolved)
        patchSession({
          compareStr1: typeof tt1?.talentString === 'string' ? tt1.talentString : '',
          compareStr2: typeof tt2?.talentString === 'string' ? tt2.talentString : '',
          compareName1: name1,
          compareName2: name2,
          specId: specId ?? null,
          p1TalentTreeJson: talentDataToP1RowsJson(tt1?.talentTree?.length ? tt1.talentTree : tt1?.talents),
        })
      } catch (e: any) {
        console.warn('Talent fetch failed:', e)
        talentDiffResolved = { t1: null, t2: null, name1, name2, error: e.message }
        setTalentDiff(talentDiffResolved)
      }

      const useSimc = simcCompareEnabled && simcAplAvailableForSpec(talentDiffResolved?.specId)
      const ctx = buildRichContext(p1, p2, talentDiffResolved, {
        isKill1,
        isKill2,
        simcGroundedAnalysis: useSimc,
      })
      const simcUserLine = useSimc
        ? `\n\n**Analysis mode:** I enabled **SimulationCraft default APL** comparison — use it with the log to show where my play diverges from those sim priorities when the evidence supports it.\n`
        : ''
      const userPrompt = `Analyze the fight data and respond in two parts:\n\n**Part 1 — Priority Summary**\nGive me a numbered list of the top 5 most impactful changes ${name1} should make, ordered by DPS impact. For each one, give a one-line description of what to change and why it matters. Keep this section tight — no more than 2 sentences per item.\n\n**Part 2 — Full Analysis**\nGo deep on each of the 5 items above. For each one:\n- What exactly is happening in the data (with specific numbers and timestamps)\n- The mechanical reason WHY it costs DPS\n- Exactly WHEN and HOW to make the decision differently\n\n${!isKill1 || !isKill2 ? `NOTE: ${[!isKill1 && `${name1}'s fight is a wipe`, !isKill2 && `${name2}'s fight is a wipe`].filter(Boolean).join(', ')}. Account for this — the fight ended early so late-phase cooldown usage and fight-end DPS patterns are not available. Focus on opener, early rotation, and mid-fight decisions.\n\n` : ''}Link every spell name to Wowhead using this format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)\nUse the spell IDs from the data. Both players are ${spec1} spec.${simcUserLine}`
      const initialThread: ChatMsg[] = [{ role: 'user', content: userPrompt }]
      setMessagesCompare(initialThread)
      setAiLoading(true)
      try {
        const reply = await callAI(initialThread, ctx)
        setMessagesCompare([...initialThread, { role: 'assistant', content: reply }].slice(-20))
      } catch (e: any) {
        setMessagesCompare([...initialThread, { role: 'assistant', content: 'Error: ' + e.message }])
      }
      setAiLoading(false)
    } catch (e: any) {
      setStatus({ type: 'err', msg: 'Error: ' + e.message })
      console.error(e)
    } finally {
      setLoading(false)
      setLoadStep('')
    }
  }, [compareUrl, patchSession, simcCompareEnabled])

  const value = useMemo<FightAnalysisCtx>(
    () => ({
      compareUrl,
      setCompareUrl,
      status,
      loading,
      loadStep,
      loadCompare,
      p1data,
      p2data,
      spellRows,
      talentDiff,
      messagesCompare,
      messagesAnalyze,
      inputCompare,
      setInputCompare,
      inputAnalyze,
      setInputAnalyze,
      aiLoading,
      simcCompareEnabled,
      setSimcCompareEnabled,
      bossName,
      fightKill1,
      fightKill2,
      authStatus,
      clientId,
      setClientId,
      authMsg,
      startAuth,
      setAuthStatus,
      sendCompareQuestion,
      sendAnalyzeQuestion,
      buildContextCompare,
      buildContextPlayerOne: buildContextPlayerOneCb,
      downloadDataCompare,
      analysisSubtab,
      setAnalysisSubtab,
      soloFromReport,
      soloPlayerChoices,
      soloRosterSelectedPlayerId,
      confirmSoloReportPlayer,
    }),
    [
      compareUrl,
      status,
      loading,
      loadStep,
      loadCompare,
      p1data,
      p2data,
      spellRows,
      talentDiff,
      messagesCompare,
      messagesAnalyze,
      inputCompare,
      inputAnalyze,
      aiLoading,
      simcCompareEnabled,
      bossName,
      fightKill1,
      fightKill2,
      authStatus,
      clientId,
      authMsg,
      startAuth,
      sendCompareQuestion,
      sendAnalyzeQuestion,
      buildContextCompare,
      buildContextPlayerOneCb,
      downloadDataCompare,
      analysisSubtab,
      soloFromReport,
      soloPlayerChoices,
      soloRosterSelectedPlayerId,
      confirmSoloReportPlayer,
    ]
  )

  return <FightAnalysisContext.Provider value={value}>{children}</FightAnalysisContext.Provider>
}

export function useFightAnalysis() {
  const c = useContext(FightAnalysisContext)
  if (!c) throw new Error('useFightAnalysis must be used within FightAnalysisProvider')
  return c
}
