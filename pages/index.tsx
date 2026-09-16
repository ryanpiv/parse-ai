import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Head from 'next/head'
import '../lib/spellTooltips'
import { useFightAnalysis, type AnalysisSubtab } from '../contexts/FightAnalysisContext'
import { SoloFightView } from '../components/analyze/SoloFightView'
import { CompareFightView } from '../components/analyze/CompareFightView'
import { AnalyzeEmptyState } from '../components/analyze/AnalyzeEmptyState'
import { WclLoadPanel } from '../components/analyze/WclLoadPanel'
import { WclLoadStatus } from '../components/WclLoadStatus'
import { PageHeader } from '../components/ui'
import type { CollapsibleBridgeApi } from '../components/CollapsibleGroup'
import { pa, s } from '../lib/styles'

export default function HomePage() {
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

  const viewBarStyle: CSSProperties = {
    marginBottom: 14,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 'var(--pa-sticky-app-nav-offset)',
    zIndex: 40,
    background: 'var(--bg)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
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

  const title =
    !logLoaded
      ? 'Parse Analyzer'
      : viewTab === 'solo'
        ? 'Solo · Parse Analyzer'
        : 'Compare · Parse Analyzer'

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div style={s.wrap}>
        <PageHeader title="Parse Analyzer" subtitle="AI-powered fight analysis" />

        {/* Before anything loads, the how-to reads top-to-bottom into the URL box below it. */}
        {!logLoaded && <AnalyzeEmptyState mode="solo" />}

        <WclLoadPanel />

        {logLoaded && (
        <>
        <div style={viewBarStyle}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: 8,
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--dim)', marginRight: 4 }}>
                View
              </span>
              <button
                type="button"
                onClick={() => goSub('solo')}
                className={`${pa.viewTab}${viewTab === 'solo' ? ` ${pa.viewTabActive}` : ''}`}
                title="Your pull only (player 1 in the compare)"
              >
                Solo
                <span className={pa.viewTabSub}>your pull</span>
              </button>
              <button
                type="button"
                onClick={() => goSub('compare')}
                className={`${pa.viewTab}${viewTab === 'compare' ? ` ${pa.viewTabActive}` : ''}`}
                title={
                  compareReady
                    ? 'You vs comparison player — side-by-side'
                    : fa.soloFromReport
                      ? 'This load is a single-player report. Load a two-player compare URL to fill this view.'
                      : 'Load a Warcraft Logs compare URL (two players), or read how below'
                }
              >
                Compare
                <span className={pa.viewTabSub}>vs other player</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 }}>
              <button
                type="button"
                disabled={!logLoaded || (viewTab === 'compare' && !compareReady)}
                onClick={expandAllSections}
                className={`${pa.btnGhost} ${pa.btnGhostViewBar}`}
                title={logLoaded ? 'Open every collapsible section' : 'Load a fight first'}
              >
                Expand all
              </button>
              <button
                type="button"
                disabled={!logLoaded || (viewTab === 'compare' && !compareReady)}
                onClick={collapseAllSections}
                className={`${pa.btnGhost} ${pa.btnGhostViewBar}`}
                title={logLoaded ? 'Close every collapsible section' : 'Load a fight first'}
              >
                Collapse all
              </button>
            </div>
          </div>
          <WclLoadStatus variant="viewbar" />
        </div>

        {compareReady ? (
          <>
            <div style={{ display: viewTab === 'solo' ? 'block' : 'none' }} aria-hidden={viewTab !== 'solo'}>
              <SoloFightView collapsibleBridgeRef={soloCollapsibleRef} />
            </div>
            {compareMounted || viewTab === 'compare' ? (
              <div
                style={{ display: viewTab === 'compare' ? 'block' : 'none' }}
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
