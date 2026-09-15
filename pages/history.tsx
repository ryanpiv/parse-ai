import Head from 'next/head'
import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { PageHeader, Panel } from '../components/ui'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { pa, s } from '../lib/styles'
import {
  clearHistory,
  readHistory,
  HISTORY_CHANGED_EVENT,
  type AnalysisHistoryEntry,
} from '../lib/analysisHistory'

const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }
const dim: CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--dim)' }

function fmtWhen(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function KindBadge({ kind }: { kind: AnalysisHistoryEntry['kind'] }) {
  const solo = kind === 'solo'
  return (
    <span
      style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 10.5,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 999,
        border: `1px solid ${solo ? 'var(--gold2)' : 'var(--blue)'}`,
        color: solo ? 'var(--gold2)' : 'var(--blue)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        width: 64,
        textAlign: 'center',
      }}
    >
      {solo ? 'Solo' : 'Compare'}
    </span>
  )
}

/** Recent solo/compare loads (localStorage) — click to load again. */
export default function HistoryPage() {
  const fa = useFightAnalysis()
  const router = useRouter()
  const [entries, setEntries] = useState<AnalysisHistoryEntry[]>([])

  useEffect(() => {
    const refresh = () => setEntries(readHistory())
    refresh()
    window.addEventListener(HISTORY_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(HISTORY_CHANGED_EVENT, refresh)
  }, [])

  function reload(entry: AnalysisHistoryEntry) {
    void fa.loadCompare(entry.url)
    void router.push('/')
  }

  return (
    <>
      <Head>
        <title>History · Parse Analyzer</title>
      </Head>
      <div style={s.wrap}>
        <PageHeader title="History" subtitle="every fight you've loaded — click to load it again" />
        <Panel title="Recent loads">
          {entries.length === 0 ? (
            <p style={mono}>
              Nothing yet — load a fight on Analyze or from Reports and it will show up here.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 480,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {entries.map(e => (
                  <button
                    key={e.url}
                    type="button"
                    disabled={fa.loading}
                    onClick={() => reload(e)}
                    title={e.url}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <KindBadge kind={e.kind} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: 'var(--font-ui)',
                          fontWeight: 600,
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.name1}
                        {e.spec1 ? ` (${e.spec1})` : ''}
                        {e.kind === 'compare' && e.name2 ? ` vs ${e.name2}${e.spec2 ? ` (${e.spec2})` : ''}` : ''}
                      </span>
                      <span style={{ ...dim, display: 'block' }}>{e.boss}</span>
                    </span>
                    <span style={{ ...dim, marginLeft: 'auto', flexShrink: 0 }}>{fmtWhen(e.accessedAt)}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className={`${pa.btnGhost} ${pa.btnGhostSm}`}
                  onClick={() => clearHistory()}
                >
                  Clear history
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  )
}
