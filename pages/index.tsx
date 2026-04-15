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
  const compareReady = Boolean(p1data && p2data && !fa.soloFromReport)

  function goSub(next: AnalysisSubtab) {
    if (next === 'compare' && !compareReady) return
    setAnalysisSubtab(next)
  }

  return (
    <>
      <Head>
        <title>
          {analysisSubtab === 'solo' ? 'Solo' : 'Compare'} · Parse Analyzer
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
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
            paddingBottom: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim)', marginRight: 4 }}>
            View
          </span>
          <button
            type="button"
            onClick={() => goSub('solo')}
            style={analysisSubtab === 'solo' ? subActive : subBase}
            title="Your pull only (player 1 in the compare)"
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
            onClick={() => goSub('compare')}
            disabled={!compareReady}
            style={
              !compareReady
                ? { ...subBase, opacity: 0.45, cursor: 'not-allowed' }
                : analysisSubtab === 'compare'
                  ? subActive
                  : subBase
            }
            title={
              compareReady
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

        {analysisSubtab === 'solo' ? <SoloFightView /> : <CompareFightView />}
      </div>
      <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}} input:focus{border-color:var(--golddim)!important;outline:none;}`}</style>
    </>
  )
}
