import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { TalentCompare } from '../components/TalentCompare'
import {
  parseTalentStringHeader,
  decodeTalentString,
  encodeTalentString,
  wclRowsToDecodedNodes,
  type DecodedTalentString,
} from '../lib/talents/decodeTalentString'
import { apiNodesToTreeNodes } from '../lib/talents/apiNodesToTreeNodes'
import { s } from '../lib/styles'
import { useAppSession } from '../contexts/AppSessionContext'

interface BlizzardTreeResponse {
  specId: number
  treeId: number
  nodes: Array<{
    nodeId: number
    nodeType: string
    entries: Array<{ maxRanks: number }>
    [key: string]: unknown
  }>
  specName: string | null
  className: string | null
  [key: string]: unknown
}

function decodedToTalentTree(decoded: DecodedTalentString) {
  return Array.from(decoded.nodes.entries()).map(([nodeID, node]) => ({
    id: 0,
    nodeID,
    rank: node.rank,
  }))
}

export default function ComparePage() {
  const router = useRouter()
  const { hydrated, session, patchSession } = useAppSession()
  const [str1, setStr1] = useState('')
  const [str2, setStr2] = useState('')
  const [name1, setName1] = useState('Build 1')
  const [name2, setName2] = useState('Build 2')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [wclUrl, setWclUrl] = useState('')
  const [wclLoading, setWclLoading] = useState(false)
  /** WCL had node rows but no export strings — strings stay empty; diff still works */
  const [wclTreesOnly, setWclTreesOnly] = useState(false)
  const [compareData, setCompareData] = useState<{
    p1: { name: string; talentTree: Array<{ id: number; nodeID: number; rank: number }> }
    p2: { name: string; talentTree: Array<{ id: number; nodeID: number; rank: number }> }
    specId: number
    specName: string
    className: string
  } | null>(null)

  const autoTriggered = useRef(false)
  const sessionRestoredRef = useRef(false)

  /** When WCL has talentTree rows — synthesize missing export strings; keep any real WCL exports. */
  const applyWclTalentTrees = useCallback(
    async (
      tree1: Array<{ id: number; nodeID: number; rank: number }>,
      tree2: Array<{ id: number; nodeID: number; rank: number }>,
      n1: string,
      n2: string,
      specId: number,
      existingExport1 = '',
      existingExport2 = ''
    ) => {
      const ex1 = existingExport1.trim()
      const ex2 = existingExport2.trim()
      const versionFromExport = ex1 || ex2 || undefined

      setError(null)
      setCompareData(null)
      setWclTreesOnly(false)
      setLoading(true)
      try {
        const res = await fetch(`/api/blizzard-tree?specId=${specId}`)
        const tree: BlizzardTreeResponse = await res.json()
        if ((tree as any).error) throw new Error((tree as any).error)
        const treeNodes = apiNodesToTreeNodes(tree.nodes)
        try {
          const enc1 = ex1
            ? ex1
            : encodeTalentString({
                specId,
                treeNodes,
                nodes: wclRowsToDecodedNodes(tree1, treeNodes),
                versionFromExport,
              })
          const enc2 = ex2
            ? ex2
            : encodeTalentString({
                specId,
                treeNodes,
                nodes: wclRowsToDecodedNodes(tree2, treeNodes),
                versionFromExport,
              })
          setStr1(enc1)
          setStr2(enc2)
          setWclTreesOnly(false)
        } catch {
          setStr1(ex1)
          setStr2(ex2)
          setWclTreesOnly(!(ex1 && ex2))
        }
        setCompareData({
          p1: { name: n1, talentTree: tree1 },
          p2: { name: n2, talentTree: tree2 },
          specId,
          specName: tree.specName || '',
          className: tree.className || '',
        })
      } catch (e: any) {
        setError(e.message || 'Failed to load talent tree.')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const runCompare = useCallback(async (s1: string, s2: string, n1: string, n2: string) => {
    setError(null)
    setCompareData(null)
    setWclTreesOnly(false)

    const trimmed1 = s1.trim()
    const trimmed2 = s2.trim()
    if (!trimmed1 || !trimmed2) {
      setError('Please paste both talent strings.')
      return
    }

    let header1, header2
    try {
      header1 = parseTalentStringHeader(trimmed1)
    } catch {
      setError('Build 1: Invalid talent string — could not parse header.')
      return
    }
    try {
      header2 = parseTalentStringHeader(trimmed2)
    } catch {
      setError('Build 2: Invalid talent string — could not parse header.')
      return
    }

    if (header1.specId !== header2.specId) {
      setError(`Spec mismatch: Build 1 is specId ${header1.specId}, Build 2 is specId ${header2.specId}. Both strings must be for the same specialization.`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/blizzard-tree?specId=${header1.specId}`)
      const tree: BlizzardTreeResponse = await res.json()
      if ((tree as any).error) throw new Error((tree as any).error)

      const treeNodes = apiNodesToTreeNodes(tree.nodes)

      let decoded1: DecodedTalentString, decoded2: DecodedTalentString
      try {
        decoded1 = decodeTalentString(trimmed1, treeNodes)
      } catch (e: any) {
        throw new Error(`Build 1: ${e.message}`)
      }
      try {
        decoded2 = decodeTalentString(trimmed2, treeNodes)
      } catch (e: any) {
        throw new Error(`Build 2: ${e.message}`)
      }

      setCompareData({
        p1: { name: n1, talentTree: decodedToTalentTree(decoded1) },
        p2: { name: n2, talentTree: decodedToTalentTree(decoded2) },
        specId: header1.specId,
        specName: tree.specName || '',
        className: tree.className || '',
      })
    } catch (e: any) {
      setError(e.message || 'Failed to fetch talent tree.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCompare = useCallback(() => {
    runCompare(str1, str2, name1, name2)
  }, [str1, str2, name1, name2, runCompare])

  // Auto-populate from query params: ?b1=...&b2=...&n1=...&n2=...
  useEffect(() => {
    if (!router.isReady || autoTriggered.current) return
    const { b1, b2, n1, n2 } = router.query
    if (typeof b1 === 'string' && typeof b2 === 'string' && b1 && b2) {
      autoTriggered.current = true
      const label1 = typeof n1 === 'string' && n1 ? n1 : 'Build 1'
      const label2 = typeof n2 === 'string' && n2 ? n2 : 'Build 2'
      setStr1(b1)
      setStr2(b2)
      setName1(label1)
      setName2(label2)
      runCompare(b1, b2, label1, label2)
    }
  }, [router.isReady, router.query, runCompare])

  // Restore fields from last session when URL has no ?b1=&b2=
  useEffect(() => {
    if (!router.isReady || !hydrated || sessionRestoredRef.current) return
    const b1 = router.query.b1
    const b2 = router.query.b2
    if (typeof b1 === 'string' && typeof b2 === 'string' && b1 && b2) {
      sessionRestoredRef.current = true
      return
    }
    sessionRestoredRef.current = true
    if (session.compareStr1 && session.compareStr2) {
      setStr1(session.compareStr1)
      setStr2(session.compareStr2)
      setName1(session.compareName1 || 'Build 1')
      setName2(session.compareName2 || 'Build 2')
      void runCompare(
        session.compareStr1,
        session.compareStr2,
        session.compareName1 || 'Build 1',
        session.compareName2 || 'Build 2'
      )
    } else if (session.compareWclUrl) {
      setWclUrl(session.compareWclUrl)
    }
  }, [
    router.isReady,
    hydrated,
    router.query.b1,
    router.query.b2,
    session.compareStr1,
    session.compareStr2,
    session.compareWclUrl,
    session.compareName1,
    session.compareName2,
    runCompare,
  ])

  useEffect(() => {
    if (!hydrated) return
    if (!str1.trim() && !str2.trim() && !wclUrl.trim()) return
    const t = setTimeout(() => {
      patchSession({
        compareStr1: str1,
        compareStr2: str2,
        compareName1: name1,
        compareName2: name2,
        compareWclUrl: wclUrl,
      })
    }, 450)
    return () => clearTimeout(t)
  }, [hydrated, str1, str2, name1, name2, wclUrl, patchSession])

  useEffect(() => {
    if (!hydrated || !compareData) return
    patchSession({ specId: compareData.specId })
  }, [hydrated, compareData, patchSession])

  const handleWclFetch = useCallback(async () => {
    const url = wclUrl.trim()
    if (!url) return
    setError(null)
    setWclLoading(true)
    try {
      const res = await fetch('/api/wcl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compare-talents', url }),
      })
      const data = await res.json()
      if (data.error) {
        const dbg = data.debug ? ` — ${JSON.stringify(data.debug)}` : ''
        throw new Error(String(data.error) + dbg)
      }

      if (data.n1) setName1(data.n1)
      if (data.n2) setName2(data.n2)

      const s1 = typeof data.b1 === 'string' ? data.b1.trim() : ''
      const s2 = typeof data.b2 === 'string' ? data.b2.trim() : ''
      setStr1(s1)
      setStr2(s2)

      patchSession({ compareWclUrl: url })

      if (s1 && s2) {
        runCompare(s1, s2, data.n1 || 'Build 1', data.n2 || 'Build 2')
      } else if (data.tree1?.length > 0 && data.tree2?.length > 0 && data.specId) {
        setWclTreesOnly(!s1 && !s2)
        await applyWclTalentTrees(
          data.tree1,
          data.tree2,
          data.n1 || 'Build 1',
          data.n2 || 'Build 2',
          data.specId,
          s1,
          s2
        )
      } else {
        setError(
          'WCL returned incomplete talent data for one or both players (no export strings and missing talent tree rows). Try re-exporting the compare URL from Warcraft Logs or pick different fights.',
        )
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch talent data from WCL.')
    } finally {
      setWclLoading(false)
    }
  }, [wclUrl, runCompare, applyWclTalentTrees, patchSession])

  const handleClear = useCallback(() => {
    setStr1('')
    setStr2('')
    setName1('Build 1')
    setName2('Build 2')
    setError(null)
    setCompareData(null)
    setWclTreesOnly(false)
    setWclUrl('')
    // Clear query params without full reload
    if (router.query.b1 || router.query.b2) {
      router.replace('/compare', undefined, { shallow: true })
    }
  }, [router])

  const ready = str1.trim().length > 0 && str2.trim().length > 0

  // Build shareable URL for current comparison
  const shareUrl = typeof window !== 'undefined' && str1.trim() && str2.trim()
    ? `${window.location.origin}/compare?b1=${encodeURIComponent(str1.trim())}&b2=${encodeURIComponent(str2.trim())}&n1=${encodeURIComponent(name1)}&n2=${encodeURIComponent(name2)}`
    : null

  return (
    <>
      <Head>
        <title>Talent Compare — parse-ai</title>
      </Head>
      <div style={s.wrap}>
        {/* Header */}
        <div style={s.hdr}>
          <div>
            <div style={s.logo}>PARSE-AI</div>
            <div style={s.logoSub}>talent compare</div>
          </div>
          <a href="/" style={{ ...s.btnGhost, textDecoration: 'none' }}>Back to analysis</a>
        </div>

        {/* WCL URL input */}
        <div style={s.panel}>
          <div style={s.ptitle}>
            <span style={s.ptitleBar} />
            Import from WarcraftLogs
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>WCL Compare URL</label>
              <input
                value={wclUrl}
                onChange={e => setWclUrl(e.target.value)}
                placeholder="https://www.warcraftlogs.com/reports/compare/ABC123/XYZ789?fight=1,2&source=3,5"
                style={s.input}
                onKeyDown={e => e.key === 'Enter' && handleWclFetch()}
              />
            </div>
            <button
              type="button"
              onClick={handleWclFetch}
              disabled={!wclUrl.trim() || wclLoading}
              style={wclUrl.trim() && !wclLoading ? s.btnGold : s.btnGoldDis}
            >
              {wclLoading ? 'Loading...' : 'Fetch talents'}
            </button>
          </div>
          <div style={s.note}>
            Paste a WCL compare URL: we use export strings when present, otherwise we synthesize strings from node rows when possible so textareas and share links stay populated.
          </div>
        </div>

        {/* Talent string inputs */}
        <div style={s.panel}>
          <div style={s.ptitle}>
            <span style={s.ptitleBar} />
            Talent strings
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={s.field}>
              <label style={s.label}>{name1}</label>
              <textarea
                value={str1}
                onChange={e => setStr1(e.target.value)}
                placeholder="Paste talent export string..."
                rows={3}
                style={{
                  ...s.input,
                  resize: 'vertical',
                  minHeight: 60,
                }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>{name2}</label>
              <textarea
                value={str2}
                onChange={e => setStr2(e.target.value)}
                placeholder="Paste talent export string..."
                rows={3}
                style={{
                  ...s.input,
                  resize: 'vertical',
                  minHeight: 60,
                }}
              />
            </div>
          </div>

          {wclTreesOnly && (
            <div style={s.alertInfo}>
              Could not synthesize export strings from this log’s talent rows (missing nodes or unusual shape). The diff still loads from WCL node data — paste in-game or Wowhead strings manually if you need a share link.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleCompare}
              disabled={!ready || loading}
              style={ready && !loading ? s.btnGold : s.btnGoldDis}
            >
              {loading ? 'Loading...' : 'Compare'}
            </button>
            {compareData && (
              <button type="button" onClick={handleClear} style={s.btnGhost}>
                Clear
              </button>
            )}
            {compareData && shareUrl && (
              <CopyLinkButton url={shareUrl} />
            )}
          </div>

          {error && <div style={s.alertErr}>{error}</div>}

          <div style={s.note}>
            Paste two talent export strings from in-game (<code>/etl</code>), Wowhead, Raidbots, or any talent calculator.
            Both strings must be for the same class and specialization.
          </div>
        </div>

        {/* Spec badge */}
        {compareData && (
          <div style={{ marginBottom: 12 }}>
            <span style={s.badge}>
              {compareData.className} — {compareData.specName}
            </span>
          </div>
        )}

        {/* Diff result */}
        {compareData && (
          <div style={s.panel}>
            <div style={s.ptitle}>
              <span style={s.ptitleBar} />
              Talent diff
            </div>
            <TalentCompare
              p1Talents={compareData.p1}
              p2Talents={compareData.p2}
              name1={name1}
              name2={name2}
              specId={compareData.specId}
            />
          </div>
        )}
      </div>
    </>
  )
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button type="button" onClick={handleCopy} style={{ ...s.btnGhost, fontSize: 10, padding: '4px 10px' }}>
      {copied ? 'Copied!' : 'Copy share link'}
    </button>
  )
}
