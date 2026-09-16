import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { s } from '../../lib/styles'
import OrDivider from '../ui/OrDivider'
import { WclKeyPrompt } from './WclKeyPrompt'
import { TopParseCompare } from './TopParseCompare'

export function AnalyzeEmptyState(props: { mode: 'solo' | 'compare' }) {
    const { mode } = props
    const fa = useFightAnalysis()
    const authNeeded = fa.authStatus === 'needed'
    const soloLoaded = Boolean(fa.p1data && fa.soloFromReport)

    return (
        <div style={s.panel}>
            <div
                style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 'var(--label-tracking)',
                    textTransform: 'var(--label-transform)' as CSSProperties['textTransform'],
                    color: 'var(--gold2)',
                    marginBottom: 10,
                }}
            >
                {mode === 'solo' ? 'No fight loaded' : 'Compare — two players needed'}
            </div>
            {authNeeded && <WclKeyPrompt />}
            <div
                style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 13.5,
                    color: 'var(--muted)',
                    lineHeight: 1.65,
                }}
            >
                {mode === 'solo' ? (
                    <>
                        <p style={{ margin: 0 }}>
                            <Link href="/reports" style={{ color: 'var(--gold2)', fontWeight: 600 }}>
                                Browse your logs on the Reports tab
                            </Link>{' '}
                            — pick a pull, pick a player.
                        </p>
                        <OrDivider />
                        <p style={{ margin: 0 }}>
                            Paste a Warcraft Logs URL below (needs{' '}
                            <code style={{ color: 'var(--blue)' }}>?fight=</code>) and click{' '}
                            <strong style={{ color: 'var(--text)' }}>Load</strong>. Compare URLs work too.
                        </p>
                    </>
                ) : (
                    <>
                        {soloLoaded && (
                            <>
                                <p style={{ margin: '0 0 10px', color: 'var(--text)' }}>
                                    Compare <strong>{fa.p1data?.name}</strong> against a world-ranked parse of
                                    the same spec.
                                </p>
                                <TopParseCompare />
                                <OrDivider />
                            </>
                        )}
                        <p style={{ margin: '0 0 8px' }}>
                            Paste a Warcraft Logs <strong style={{ color: 'var(--text)' }}>compare</strong>{' '}
                            URL below and click Load:
                        </p>
                        <p
                            style={{
                                margin: 0,
                                fontFamily: 'var(--font-mono)',
                                fontSize: 12.5,
                                color: 'var(--blue)',
                                wordBreak: 'break-all',
                            }}
                        >
                            /reports/compare/CODE1/CODE2?fight=12,5&source=1,2
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
