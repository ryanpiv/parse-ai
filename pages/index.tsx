import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Head from 'next/head'
import '../lib/spellTooltips'
import { useFightAnalysis, type AnalysisSubtab } from '../contexts/FightAnalysisContext'
import { SoloFightView } from '../components/analyze/SoloFightView'
import { CompareFightView } from '../components/analyze/CompareFightView'
import type { CollapsibleBridgeApi } from '../components/CollapsibleGroup'
import { pa, s } from '../lib/styles'

export default function HomePage() {
  const fa = useFightAnalysis()
  const { analysisSubtab, setAnalysisSubtab, p1data, p2data } = fa
  const logLoaded = Boolean(p1data)
  const compareReady = Boolean(p1data && p2data && !fa.soloFromReport)

  const soloCollapsibleRef = useRef<CollapsibleBridgeApi | null>(null)
  const compareCollapsibleRef = useRef<CollapsibleBridgeApi | null>(null)

  const [compareMounted, setCompareMounted] = useState(false)
  useEffect(() => {
    if (compareReady && analysisSubtab === 'compare') setCompareMounted(true)
  }, [compareReady, analysisSubtab])

  /** Window scroll per tab — toggling panes changes document height and clamps scroll; save before commit in goSub, restore after layout. */
  const scrollYByTabRef = useRef({ solo: 0, compare: 0 })
  /** After first dual-mode layout, seed current tab's Y; then restores run on tab changes. */
  const dualScrollPrimedRef = useRef(false)

  useLayoutEffect(() => {
    if (!logLoaded || !compareReady) {
      dualScrollPrimedRef.current = false
      return
    }
    const tab = analysisSubtab
    if (tab !== 'solo' && tab !== 'compare') return

    if (!dualScrollPrimedRef.current) {
      dualScrollPrimedRef.current = true
      scrollYByTabRef.current[tab] = window.scrollY
      return
    }

    window.scrollTo(0, scrollYByTabRef.current[tab])
  }, [analysisSubtab, logLoaded, compareReady])

  function goSub(next: Exclude<AnalysisSubtab, 'none'>) {
    if (!logLoaded) return
    if (next === 'compare' && !compareReady) return
    if (
      compareReady &&
      (analysisSubtab === 'solo' || analysisSubtab === 'compare') &&
      (next === 'solo' || next === 'compare') &&
      next !== analysisSubtab
    ) {
      scrollYByTabRef.current[analysisSubtab] = window.scrollY
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
    if (analysisSubtab === 'solo') soloCollapsibleRef.current?.expandAll()
    else compareCollapsibleRef.current?.expandAll()
  }

  function collapseAllSections() {
    if (!logLoaded) return
    if (analysisSubtab === 'solo') soloCollapsibleRef.current?.collapseAll()
    else compareCollapsibleRef.current?.collapseAll()
  }

  return (
    <>
      <Head>
        <title>
          {!logLoaded ? 'Parse Analyzer' : analysisSubtab === 'solo' ? 'Solo · Parse Analyzer' : analysisSubtab === 'compare' ? 'Compare · Parse Analyzer' : 'Parse Analyzer'}
        </title>
      </Head>
      <div style={s.wrap}>
        <div style={s.hdr}>
          <div>
            <div style={s.logo}>PARSE ANALYZER</div>
            <div style={s.logoSub}>AI-powered fight analysis</div>
          </div>
        </div>

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
              <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim)', marginRight: 4 }}>
                View
              </span>
              <button
                type="button"
                disabled={!logLoaded}
                onClick={() => goSub('solo')}
                className={`${pa.viewTab}${!logLoaded ? '' : analysisSubtab === 'solo' ? ` ${pa.viewTabActive}` : ''}`}
                title={
                  logLoaded ? 'Your pull only (player 1 in the compare)' : 'Load a fight from Warcraft Logs first'
                }
              >
                Solo
                <span className={pa.viewTabSub}>your pull</span>
              </button>
              <button
                type="button"
                disabled={!logLoaded || !compareReady}
                onClick={() => goSub('compare')}
                className={
                  pa.viewTab +
                  (!logLoaded || !compareReady ? '' : analysisSubtab === 'compare' ? ` ${pa.viewTabActive}` : '')
                }
                title={
                  !logLoaded
                    ? 'Load a Warcraft Logs fight first'
                    : compareReady
                      ? 'You vs comparison player — side-by-side'
                      : fa.soloFromReport
                        ? 'Compare needs a two-player Warcraft Logs compare URL'
                        : 'Load a Warcraft Logs compare URL (two players) first'
                }
              >
                Compare
                <span className={pa.viewTabSub}>vs other player</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 }}>
              <button
                type="button"
                disabled={!logLoaded}
                onClick={expandAllSections}
                className={`${pa.btnGhost} ${pa.btnGhostViewBar}`}
                title={logLoaded ? 'Open every collapsible section' : 'Load a fight first'}
              >
                Expand all
              </button>
              <button
                type="button"
                disabled={!logLoaded}
                onClick={collapseAllSections}
                className={`${pa.btnGhost} ${pa.btnGhostViewBar}`}
                title={logLoaded ? 'Close every collapsible section' : 'Load a fight first'}
              >
                Collapse all
              </button>
            </div>
          </div>
        </div>

        {logLoaded && compareReady ? (
          <>
            <div style={{ display: analysisSubtab === 'solo' ? 'block' : 'none' }} aria-hidden={analysisSubtab !== 'solo'}>
              <SoloFightView collapsibleBridgeRef={soloCollapsibleRef} />
            </div>
            {compareMounted || analysisSubtab === 'compare' ? (
              <div
                style={{ display: analysisSubtab === 'compare' ? 'block' : 'none' }}
                aria-hidden={analysisSubtab !== 'compare'}
              >
                <CompareFightView collapsibleBridgeRef={compareCollapsibleRef} />
              </div>
            ) : null}
          </>
        ) : (
          <SoloFightView collapsibleBridgeRef={soloCollapsibleRef} />
        )}
      </div>
      <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}} input:focus{border-color:var(--golddim)!important;outline:none;}`}</style>
    </>
  )
}
