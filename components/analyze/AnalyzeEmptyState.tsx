import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { s } from '../../lib/styles'

export function AnalyzeEmptyState(props: { mode: 'solo' | 'compare' }) {
  const { mode } = props
  const fa = useFightAnalysis()
  const authNeeded = fa.authStatus === 'needed'
  const soloLoaded = Boolean(fa.p1data && fa.soloFromReport)

  return (
    <div style={s.panel}>
      <div
        style={{
          fontFamily: 'Rajdhani,sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--gold2)',
          marginBottom: 10,
        }}
      >
        {mode === 'solo' ? 'Solo — no fight loaded' : 'Compare — two players needed'}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
        {authNeeded && (
          <p style={{ marginBottom: 10, color: 'var(--red)' }}>
            Connect Warcraft Logs in the strip above (Client ID → Authenticate) before Load will work.
          </p>
        )}
        {mode === 'solo' ? (
          <>
            <p style={{ marginBottom: 8 }}>
              Paste a report URL in <strong style={{ color: 'var(--text)' }}>Warcraft Logs</strong> above, then click{' '}
              <strong style={{ color: 'var(--text)' }}>Load</strong>.
            </p>
            <p style={{ marginBottom: 8 }}>
              Single-report links must include <code style={{ color: 'var(--blue)' }}>?fight=</code> (a fight id,{' '}
              <code style={{ color: 'var(--blue)' }}>last</code>, or <code style={{ color: 'var(--blue)' }}>first</code>
              ). Copy the URL while viewing that pull on Warcraft Logs.
            </p>
            <p>
              A compare URL also works here — you are <strong style={{ color: 'var(--gold2)' }}>player 1</strong>. Switch
              to Compare after both players load.
            </p>
            <p style={{ marginTop: 10, color: 'var(--dim)' }}>
              If Load sits on “Fetching report metadata…” and never finishes, this app’s server is not answering. Run{' '}
              <code style={{ color: 'var(--blue)' }}>npm run dev</code> and open http://localhost:3000. GraphQL uses{' '}
              <code style={{ color: 'var(--blue)' }}>WCL_TOKEN</code> in <code style={{ color: 'var(--blue)' }}>.env.local</code>
              — the green “connected” badge is OAuth and is not enough by itself.
            </p>
          </>
        ) : (
          <>
            {soloLoaded && (
              <p style={{ marginBottom: 10, color: 'var(--text)' }}>
                This session is a <strong>single-player report</strong>. Compare stays empty until you Load a two-player
                compare URL.
              </p>
            )}
            <p style={{ marginBottom: 8 }}>
              Use a Warcraft Logs <strong style={{ color: 'var(--text)' }}>compare</strong> URL, then Load. It looks like:
            </p>
            <p style={{ marginBottom: 8, color: 'var(--blue)', wordBreak: 'break-all' }}>
              /reports/compare/CODE1/CODE2?fight=12,5&source=1,2
            </p>
            <p>
              That enables side-by-side charts, talents, and compare chat. Solo still works from the same load for player
              1.
            </p>
            <p style={{ marginTop: 10, color: 'var(--dim)' }}>
              Copy the full URL from the address bar (not a truncated <code style={{ color: 'var(--blue)' }}>compares</code>{' '}
              fragment). If Load never leaves “Fetching report metadata…”, run{' '}
              <code style={{ color: 'var(--blue)' }}>npm run dev</code> and retry.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
