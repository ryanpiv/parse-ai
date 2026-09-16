import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Head from 'next/head'
import '../lib/spellTooltips'
import ui from '../styles/ui.module.css'
import styles from '../styles/pages/index.module.css'
import { useFightAnalysis, type AnalysisSubtab } from '../contexts/FightAnalysisContext'
import SoloFightView from '../components/analyze/SoloFightView'
import CompareFightView from '../components/analyze/CompareFightView'
import AnalyzeEmptyState from '../components/analyze/AnalyzeEmptyState'
import WclLoadPanel from '../components/analyze/WclLoadPanel'
import WclLoadStatus from '../components/WclLoadStatus'
import PageHeader from '../components/ui/PageHeader'
import type { CollapsibleBridgeApi } from '../components/CollapsibleGroup'

const HomePage = () => {
    const fa = useFightAnalysis()
    const { analysisSubtab, setAnalysisSubtab, p1data, p2data } = fa
    const viewTab: Exclude<AnalysisSubtab, 'none'> = analysisSubtab === 'compare' ? 'compare' : 'solo'
    const logLoaded = Boolean(p1data)
    const compareReady = Boolean(p1data && p2data && !fa.soloFromReport)

    const soloCollapsibleRef = useRef<CollapsibleBridgeApi | null>(null)
    const compareCollapsibleRef = useRef<CollapsibleBridgeApi | null>(null)

    const [compareMounted, setCompareMounted] = useState(false)
    useEffect(() => {
        if (compareReady && viewTab === 'compare') setCompareMounted(true)
    }, [compareReady, viewTab])

    /** Window scroll per tab — toggling panes changes document height and clamps scroll; save before commit in goSub, restore after layout. */
    const scrollYByTabRef = useRef({ solo: 0, compare: 0 })
    /** After first dual-mode layout, seed current tab's Y; then restores run on tab changes. */
    const dualScrollPrimedRef = useRef(false)

    useLayoutEffect(() => {
        if (!logLoaded || !compareReady) {
            dualScrollPrimedRef.current = false
            return
        }
        const tab = viewTab

        if (!dualScrollPrimedRef.current) {
            dualScrollPrimedRef.current = true
            scrollYByTabRef.current[tab] = window.scrollY
            return
        }

        window.scrollTo(0, scrollYByTabRef.current[tab])
    }, [viewTab, logLoaded, compareReady])

    function goSub(next: Exclude<AnalysisSubtab, 'none'>) {
        if (compareReady && next !== viewTab) {
            scrollYByTabRef.current[viewTab] = window.scrollY
        }
        setAnalysisSubtab(next)
    }

    function expandAllSections() {
        if (!logLoaded) return
        if (viewTab === 'solo') soloCollapsibleRef.current?.expandAll()
        else if (compareReady) compareCollapsibleRef.current?.expandAll()
    }

    function collapseAllSections() {
        if (!logLoaded) return
        if (viewTab === 'solo') soloCollapsibleRef.current?.collapseAll()
        else if (compareReady) compareCollapsibleRef.current?.collapseAll()
    }

    const title = !logLoaded
        ? 'Parse Analyzer'
        : viewTab === 'solo'
          ? 'Solo · Parse Analyzer'
          : 'Compare · Parse Analyzer'

    return (
        <>
            <Head>
                <title>{title}</title>
            </Head>
            <div className={ui.wrap}>
                <PageHeader title="Parse Analyzer" subtitle="AI-powered fight analysis" />

                {/* Before anything loads, the how-to reads top-to-bottom into the URL box below it. */}
                {!logLoaded && <AnalyzeEmptyState mode="solo" />}

                <WclLoadPanel />

                {logLoaded && (
                    <>
                        <div className={styles.viewBar}>
                            <div className={styles.viewBarRow}>
                                <div className={styles.viewTabGroup}>
                                    <span className={styles.viewBarLabel}>View</span>
                                    <button
                                        type="button"
                                        onClick={() => goSub('solo')}
                                        className={`${ui.viewTab}${viewTab === 'solo' ? ` ${ui.viewTabActive}` : ''}`}
                                        title="Your pull only (player 1 in the compare)"
                                    >
                                        Solo
                                        <span className={ui.viewTabSub}>your pull</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => goSub('compare')}
                                        className={`${ui.viewTab}${viewTab === 'compare' ? ` ${ui.viewTabActive}` : ''}`}
                                        title={
                                            compareReady
                                                ? 'You vs comparison player — side-by-side'
                                                : fa.soloFromReport
                                                  ? 'This load is a single-player report. Load a two-player compare URL to fill this view.'
                                                  : 'Load a Warcraft Logs compare URL (two players), or read how below'
                                        }
                                    >
                                        Compare
                                        <span className={ui.viewTabSub}>vs other player</span>
                                    </button>
                                </div>
                                <div className={styles.sectionButtonGroup}>
                                    <button
                                        type="button"
                                        disabled={!logLoaded || (viewTab === 'compare' && !compareReady)}
                                        onClick={expandAllSections}
                                        className={`${ui.btnGhost} ${ui.btnGhostViewBar}`}
                                        title={
                                            logLoaded
                                                ? 'Open every collapsible section'
                                                : 'Load a fight first'
                                        }
                                    >
                                        Expand all
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!logLoaded || (viewTab === 'compare' && !compareReady)}
                                        onClick={collapseAllSections}
                                        className={`${ui.btnGhost} ${ui.btnGhostViewBar}`}
                                        title={
                                            logLoaded
                                                ? 'Close every collapsible section'
                                                : 'Load a fight first'
                                        }
                                    >
                                        Collapse all
                                    </button>
                                </div>
                            </div>
                            <WclLoadStatus variant="viewbar" />
                        </div>

                        {compareReady ? (
                            <>
                                <div
                                    className={viewTab === 'solo' ? undefined : styles.hiddenPane}
                                    aria-hidden={viewTab !== 'solo'}
                                >
                                    <SoloFightView collapsibleBridgeRef={soloCollapsibleRef} />
                                </div>
                                {compareMounted || viewTab === 'compare' ? (
                                    <div
                                        className={viewTab === 'compare' ? undefined : styles.hiddenPane}
                                        aria-hidden={viewTab !== 'compare'}
                                    >
                                        <CompareFightView collapsibleBridgeRef={compareCollapsibleRef} />
                                    </div>
                                ) : null}
                            </>
                        ) : viewTab === 'compare' ? (
                            <AnalyzeEmptyState mode="compare" />
                        ) : (
                            <SoloFightView collapsibleBridgeRef={soloCollapsibleRef} />
                        )}
                    </>
                )}
            </div>
            <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}} input:focus{border-color:var(--golddim)!important;outline:none;}`}</style>
        </>
    )
}

export default HomePage
