import type { CSSProperties } from 'react'
import Head from 'next/head'
import '../lib/spellTooltips'
import { useFightAnalysis, type AnalysisSubtab } from '../contexts/FightAnalysisContext'
import { SoloFightView } from '../components/analyze/SoloFightView'
import { CompareFightView } from '../components/analyze/CompareFightView'
import { s } from '../lib/styles'

const subBase: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '8px 16px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  background: 'var(--bg3)',
  color: 'var(--dim)',
}

const subActive: CSSProperties = {
  ...subBase,
  borderColor: 'var(--golddim)',
  color: 'var(--gold2)',
  background: 'var(--bg2)',
}

export default function HomePage() {
  const fa = useFightAnalysis()
  const { analysisSubtab, setAnalysisSubtab, p1data, p2data } = fa
  const logLoaded = Boolean(p1data)
  const compareReady = Boolean(p1data && p2data && !fa.soloFromReport)

  function goSub(next: Exclude<AnalysisSubtab, 'none'>) {
    if (!logLoaded) return
    if (next === 'compare' && !compareReady) return
    setAnalysisSubtab(next)
  }

  const tabMuted: CSSProperties = { ...subBase, opacity: 0.45, cursor: 'not-allowed' }

  const showComparePane = logLoaded && analysisSubtab === 'compare'

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
          <span style={s.badge}>✦ Claude AI</span>
        </div>

        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            marginBottom: 14,
            paddingTop: 4,
            paddingBottom: 12,
            background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim)', marginRight: 4 }}>
              View
            </span>
            <button
              type="button"
              disabled={!logLoaded}
              onClick={() => goSub('solo')}
              style={
                !logLoaded
                  ? tabMuted
                  : analysisSubtab === 'solo'
                    ? subActive
                    : subBase
              }
              title={
                logLoaded ? 'Your pull only (player 1 in the compare)' : 'Load a fight from Warcraft Logs first'
              }
            >
              Solo
              <span
                style={{
                  display: 'block',
                  fontFamily: 'IBM Plex Mono,monospace',
                  fontSize: 9,
                  fontWeight: 400,
                  letterSpacing: 0,
                  textTransform: 'none',
                  color: 'var(--dim)',
                  marginTop: 2,
                }}
              >
                your pull
              </span>
            </button>
            <button
              type="button"
              disabled={!logLoaded || !compareReady}
              onClick={() => goSub('compare')}
              style={
                !logLoaded
                  ? tabMuted
                  : !compareReady
                    ? { ...subBase, opacity: 0.45, cursor: 'not-allowed' }
                    : analysisSubtab === 'compare'
                      ? subActive
                      : subBase
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
              <span
                style={{
                  display: 'block',
                  fontFamily: 'IBM Plex Mono,monospace',
                  fontSize: 9,
                  fontWeight: 400,
                  letterSpacing: 0,
                  textTransform: 'none',
                  color: 'var(--dim)',
                  marginTop: 2,
                }}
              >
                vs other player
              </span>
            </button>
          </div>
        </div>

        {showComparePane ? <CompareFightView /> : <SoloFightView />}
      </div>
      <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}} input:focus{border-color:var(--golddim)!important;outline:none;}`}</style>
    </>
  )
}
