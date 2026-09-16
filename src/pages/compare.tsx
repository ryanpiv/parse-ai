import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { TalentCompare, FullTalentTree, fetchBlizzardTree } from '../components/TalentCompare'
import {
    parseTalentStringHeader,
    decodeTalentString,
    encodeTalentString,
    wclRowsToDecodedNodes,
    type DecodedTalentString,
} from '../lib/talents/decodeTalentString'
import { apiNodesToTreeNodes } from '../lib/talents/apiNodesToTreeNodes'
import { parseNextApiJson } from '../lib/wclClient'
import { wclClientHeaders } from '../lib/wclUserToken'
import ui from '../styles/ui.module.css'
import styles from '../styles/pages/compare.module.css'
import Accordion from '../components/ui/Accordion'
import FieldRow from '../components/ui/FieldRow'
import OrDivider from '../components/ui/OrDivider'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { useAppSession } from '../contexts/AppSessionContext'
import { useAnalyzePageCache } from '../contexts/AnalyzePageCacheContext'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { talentDataToP1RowsJson } from '../lib/talents/p1TalentTreeSession'

function decodedToTalentTree(decoded: DecodedTalentString) {
    return Array.from(decoded.nodes.entries()).map(([nodeID, node]) => ({
        id: 0,
        nodeID,
        rank: node.rank,
    }))
}

const ComparePage = () => {
    const router = useRouter()
    const analyzeCache = useAnalyzePageCache()
    const { hydrated, session, patchSession } = useAppSession()
    const { compareUrl, setCompareUrl } = useFightAnalysis()
    const [str1, setStr1] = useState('')
    const [str2, setStr2] = useState('')
    const [name1, setName1] = useState('Build 1')
    const [name2, setName2] = useState('Build 2')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [wclLoading, setWclLoading] = useState(false)
    /** WCL had node rows but no export strings — strings stay empty; diff still works */
    const [wclTreesOnly, setWclTreesOnly] = useState(false)
    /** Side-by-side diff vs full trees stacked per player (same render as the Talents tab). */
    const [treeView, setTreeView] = useState<'diff' | 'full'>('diff')
    /** WCL URL accordion — opened automatically (once) when a logs link is present. */
    const [wclOpen, setWclOpen] = useState(false)
    const wclOpenedOnceRef = useRef(false)
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
            existingExport2 = '',
        ) => {
            const ex1 = existingExport1.trim()
            const ex2 = existingExport2.trim()
            const versionFromExport = ex1 || ex2 || undefined

            setError(null)
            setCompareData(null)
            setWclTreesOnly(false)
            setLoading(true)
            try {
                const tree = await fetchBlizzardTree(specId)
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
                setError(`Loading the talent tree failed — ${e.message || 'unknown error'}`)
            } finally {
                setLoading(false)
            }
        },
        [],
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
            setError(
                `Spec mismatch: Build 1 is specId ${header1.specId}, Build 2 is specId ${header2.specId}. Both strings must be for the same specialization.`,
            )
            return
        }

        setLoading(true)
        try {
            const tree = await fetchBlizzardTree(header1.specId)
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

    // Restore from ?b1=&b2=, then in-memory Analyze snapshot, then persisted session.
    useEffect(() => {
        if (!router.isReady || !hydrated || sessionRestoredRef.current) return
        const b1 = router.query.b1
        const b2 = router.query.b2
        if (typeof b1 === 'string' && typeof b2 === 'string' && b1 && b2) {
            sessionRestoredRef.current = true
            return
        }
        sessionRestoredRef.current = true

        const snap = analyzeCache.read()

        if (snap?.p1data && snap?.p2data && snap.talentDiff) {
            const td = snap.talentDiff as {
                t1?: {
                    talentString?: string
                    talentTree?: Array<{ id: number; nodeID: number; rank: number }>
                }
                t2?: {
                    talentString?: string
                    talentTree?: Array<{ id: number; nodeID: number; rank: number }>
                }
                name1?: string
                name2?: string
                specId?: number
                error?: string
            }
            if (td.specId && !td.error) {
                const n1 = td.name1 || (snap.p1data as { name?: string }).name || 'Build 1'
                const n2 = td.name2 || (snap.p2data as { name?: string }).name || 'Build 2'
                const ex1 = typeof td.t1?.talentString === 'string' ? td.t1.talentString.trim() : ''
                const ex2 = typeof td.t2?.talentString === 'string' ? td.t2.talentString.trim() : ''
                const tree1 = td.t1?.talentTree
                const tree2 = td.t2?.talentTree
                if (ex1 && ex2) {
                    setStr1(ex1)
                    setStr2(ex2)
                    setName1(n1)
                    setName2(n2)
                    void runCompare(ex1, ex2, n1, n2)
                    return
                }
                if (Array.isArray(tree1) && tree1.length > 0 && Array.isArray(tree2) && tree2.length > 0) {
                    setName1(n1)
                    setName2(n2)
                    void applyWclTalentTrees(tree1, tree2, n1, n2, td.specId, ex1, ex2)
                    return
                }
            }
        }

        if (session.compareStr1 && session.compareStr2) {
            setStr1(session.compareStr1)
            setStr2(session.compareStr2)
            setName1(session.compareName1 || 'Build 1')
            setName2(session.compareName2 || 'Build 2')
            void runCompare(
                session.compareStr1,
                session.compareStr2,
                session.compareName1 || 'Build 1',
                session.compareName2 || 'Build 2',
            )
            return
        }

        // Nothing restored — prefill the WCL URL (from this page or parse AI) but never auto-fetch;
        // loading from logs only happens when the user clicks the button.
        const candidateUrl = compareUrl.trim() || session.compareWclUrl.trim() || session.wclCompareUrl.trim()
        if (!candidateUrl) return
        if (!compareUrl.trim()) setCompareUrl(candidateUrl)
    }, [
        router.isReady,
        hydrated,
        router.query.b1,
        router.query.b2,
        session.compareStr1,
        session.compareStr2,
        session.compareWclUrl,
        session.wclCompareUrl,
        session.compareName1,
        session.compareName2,
        compareUrl,
        runCompare,
        applyWclTalentTrees,
        analyzeCache,
        setCompareUrl,
    ])

    useEffect(() => {
        if (!hydrated) return
        if (!str1.trim() && !str2.trim() && !compareUrl.trim()) return
        const t = setTimeout(() => {
            patchSession({
                compareStr1: str1,
                compareStr2: str2,
                compareName1: name1,
                compareName2: name2,
                compareWclUrl: compareUrl,
            })
        }, 450)
        return () => clearTimeout(t)
    }, [hydrated, str1, str2, name1, name2, compareUrl, patchSession])

    useEffect(() => {
        if (!hydrated || !compareData) return
        patchSession({ specId: compareData.specId })
    }, [hydrated, compareData, patchSession])

    // Reflect the loaded comparison in the address bar (?b1=&b2=&n1=&n2=) so a
    // refresh or copied URL reproduces it. Runs only when a compare completes —
    // typing in the boxes alone doesn't rewrite the URL.
    useEffect(() => {
        if (!router.isReady || !compareData) return
        const t1 = str1.trim()
        const t2 = str2.trim()
        if (!t1 || !t2) return // WCL trees-only loads have no export strings to encode
        const params = new URLSearchParams({ b1: t1, b2: t2 })
        const label1 = compareData.p1.name || name1
        const label2 = compareData.p2.name || name2
        if (label1 && label1 !== 'Build 1') params.set('n1', label1)
        if (label2 && label2 !== 'Build 2') params.set('n2', label2)
        const next = `/compare?${params.toString()}`
        if (router.asPath === next) return
        // The query-param effect must not re-run the compare we just finished.
        autoTriggered.current = true
        void router.replace(next, undefined, { shallow: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, compareData])

    useEffect(() => {
        if (!hydrated || !compareData?.p1?.talentTree?.length) return
        patchSession({ p1TalentTreeJson: talentDataToP1RowsJson(compareData.p1.talentTree) })
    }, [hydrated, compareData?.p1?.talentTree, patchSession])

    const handleWclFetch = useCallback(
        async (urlArg?: string) => {
            const url = (urlArg ?? compareUrl).trim()
            if (!url) return
            setError(null)
            setWclLoading(true)
            try {
                const res = await fetch('/api/wcl', {
                    method: 'POST',
                    headers: wclClientHeaders(),
                    body: JSON.stringify({ action: 'compare-talents', url }),
                })
                const data = await parseNextApiJson(res, '/api/wcl')
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

                patchSession({
                    compareWclUrl: url,
                    p1TalentTreeJson: talentDataToP1RowsJson(data.tree1),
                })

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
                        s2,
                    )
                } else {
                    setError(
                        'WCL returned incomplete talent data for one or both players (no export strings and missing talent tree rows). Try re-exporting the compare URL from Warcraft Logs or pick different fights.',
                    )
                }
            } catch (e: any) {
                setError(`Loading builds from Warcraft Logs failed — ${e.message || 'unknown error'}`)
            } finally {
                setWclLoading(false)
            }
        },
        [compareUrl, runCompare, applyWclTalentTrees, patchSession],
    )

    // Open the WCL accordion once when a logs link is present (restored or typed elsewhere).
    useEffect(() => {
        if (!hydrated || wclOpenedOnceRef.current || !compareUrl.trim()) return
        wclOpenedOnceRef.current = true
        setWclOpen(true)
    }, [hydrated, compareUrl])

    const handleClear = useCallback(() => {
        setStr1('')
        setStr2('')
        setName1('Build 1')
        setName2('Build 2')
        setError(null)
        setCompareData(null)
        setWclTreesOnly(false)
        setCompareUrl('')
        // Clear query params without full reload
        if (router.query.b1 || router.query.b2) {
            router.replace('/compare', undefined, { shallow: true })
        }
    }, [router, setCompareUrl])

    const ready = str1.trim().length > 0 && str2.trim().length > 0

    // Build shareable URL for current comparison
    const shareUrl =
        typeof window !== 'undefined' && str1.trim() && str2.trim()
            ? `${window.location.origin}/compare?b1=${encodeURIComponent(str1.trim())}&b2=${encodeURIComponent(str2.trim())}&n1=${encodeURIComponent(name1)}&n2=${encodeURIComponent(name2)}`
            : null

    return (
        <>
            <Head>
                <title>Talent Compare — parse-ai</title>
            </Head>
            <div className={ui.wrap}>
                <PageHeader
                    title="Talent compare"
                    subtitle="Diff two builds — two export strings, or one WCL compare URL"
                />

                {/* Talent inputs: two export strings OR a WCL compare URL */}
                <Panel title="Builds — two export strings or a WCL compare URL">
                    <div className={styles.accordionBlock}>
                        <Accordion
                            label="Load from Warcraft Logs (compare URL)"
                            open={wclOpen}
                            onToggle={() => setWclOpen((o) => !o)}
                        >
                            <FieldRow
                                label="Warcraft Logs compare URL"
                                action={
                                    <button
                                        type="button"
                                        onClick={() => void handleWclFetch()}
                                        disabled={!compareUrl.trim() || wclLoading}
                                        className={ui.btnGold}
                                    >
                                        {wclLoading ? 'Loading...' : 'Fetch both builds'}
                                    </button>
                                }
                            >
                                <input
                                    className={ui.input}
                                    value={compareUrl}
                                    onChange={(e) => setCompareUrl(e.target.value)}
                                    placeholder="https://www.warcraftlogs.com/reports/compare/…"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && compareUrl.trim() && !wclLoading)
                                            void handleWclFetch()
                                    }}
                                />
                            </FieldRow>
                        </Accordion>
                    </div>

                    {wclOpen && <OrDivider label="or paste two export strings" />}

                    <div className={styles.stringsGrid}>
                        <div className={ui.field}>
                            <label className={ui.label}>{name1}</label>
                            <textarea
                                value={str1}
                                onChange={(e) => setStr1(e.target.value)}
                                placeholder="Paste talent export string..."
                                rows={3}
                                className={`${ui.input} ${styles.stringInput}`}
                            />
                        </div>
                        <div className={ui.field}>
                            <label className={ui.label}>{name2}</label>
                            <textarea
                                value={str2}
                                onChange={(e) => setStr2(e.target.value)}
                                placeholder="Paste talent export string..."
                                rows={3}
                                className={`${ui.input} ${styles.stringInput}`}
                            />
                        </div>
                    </div>

                    {wclTreesOnly && (
                        <div className={ui.alertInfo}>
                            Could not synthesize export strings from this log’s talent rows (missing nodes or
                            unusual shape). The diff still loads from WCL node data — paste in-game or Wowhead
                            strings manually if you need a share link.
                        </div>
                    )}

                    <div className={styles.actionsRow}>
                        <button
                            type="button"
                            onClick={handleCompare}
                            disabled={!ready || loading}
                            className={ui.btnGold}
                        >
                            {loading ? 'Loading...' : 'Compare'}
                        </button>
                        {compareData && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className={`${ui.btnGhost} ${ui.btnGhostPrimaryRow}`}
                            >
                                Clear
                            </button>
                        )}
                        {compareData && shareUrl && <CopyLinkButton url={shareUrl} />}
                    </div>

                    {error && <div className={ui.alertErr}>{error}</div>}

                    <div className={ui.note}>
                        Export strings come from in-game (<code>/etl</code>), Wowhead, Raidbots, or any talent
                        calculator. Both strings must be for the same class and specialization.
                    </div>
                </Panel>

                {/* Spec badge */}
                {compareData && (
                    <div className={styles.specBadgeRow}>
                        <span className={ui.badge}>
                            {compareData.className} — {compareData.specName}
                        </span>
                    </div>
                )}

                {/* Diff result */}
                {compareData && (
                    <Panel
                        title={treeView === 'diff' ? 'Talent diff' : 'Full trees'}
                        actions={
                            <span className={styles.viewTabs}>
                                <button
                                    type="button"
                                    className={`${ui.viewTab}${treeView === 'diff' ? ` ${ui.viewTabActive}` : ''}`}
                                    onClick={() => setTreeView('diff')}
                                >
                                    Compare
                                </button>
                                <button
                                    type="button"
                                    className={`${ui.viewTab}${treeView === 'full' ? ` ${ui.viewTabActive}` : ''}`}
                                    onClick={() => setTreeView('full')}
                                >
                                    Single tree
                                </button>
                            </span>
                        }
                    >
                        {treeView === 'diff' ? (
                            <TalentCompare
                                p1Talents={compareData.p1}
                                p2Talents={compareData.p2}
                                name1={compareData.p1.name || name1}
                                name2={compareData.p2.name || name2}
                                specId={compareData.specId}
                            />
                        ) : (
                            <>
                                {(
                                    [
                                        {
                                            name: compareData.p1.name || name1,
                                            data: compareData.p1,
                                            str: str1,
                                        },
                                        {
                                            name: compareData.p2.name || name2,
                                            data: compareData.p2,
                                            str: str2,
                                        },
                                    ] as const
                                ).map((build, i) => (
                                    <div key={i} className={i === 0 ? styles.buildBlockFirst : undefined}>
                                        <div className={`${ui.label} ${styles.buildName}`}>{build.name}</div>
                                        <FullTalentTree
                                            specId={compareData.specId}
                                            rows={build.data.talentTree.map((t) => ({
                                                nodeID: t.nodeID,
                                                rank: t.rank,
                                            }))}
                                            exportString={build.str}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </Panel>
                )}
            </div>
        </>
    )
}

const CopyLinkButton = ({ url }: { url: string }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }
    return (
        <button type="button" onClick={handleCopy} className={`${ui.btnGhost} ${ui.btnGhostPrimaryRow}`}>
            {copied ? 'Copied!' : 'Copy share link'}
        </button>
    )
}

export default ComparePage
