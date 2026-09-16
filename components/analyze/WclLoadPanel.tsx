import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { pa, s } from '../../lib/styles'
import FieldRow from '../ui/FieldRow'
import Panel from '../ui/Panel'
import WclLoadStatus from '../WclLoadStatus'

/** Analyze entry point: WCL report/compare URL + Load, status alerts, and the solo roster picker. */
export function WclLoadPanel() {
    const fa = useFightAnalysis()
    const canOpen = Boolean(fa.p1data) && Boolean(fa.compareUrl.trim())

    return (
        <Panel title="Warcraft Logs">
            <FieldRow
                label="Report or compare URL"
                action={
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className={pa.btnGold}
                            disabled={fa.loading}
                            aria-busy={fa.loading}
                            onClick={() => void fa.loadCompare()}
                        >
                            {fa.loading ? fa.loadStep || 'Loading...' : 'Load'}
                        </button>
                        <button
                            type="button"
                            className={pa.btnGhost}
                            disabled={!canOpen}
                            title={canOpen ? 'Open this log on warcraftlogs.com' : 'Load a log first'}
                            onClick={() => window.open(fa.compareUrl.trim(), '_blank', 'noopener,noreferrer')}
                        >
                            Open ↗
                        </button>
                    </div>
                }
                style={{ marginBottom: 10 }}
            >
                <input
                    style={s.input}
                    value={fa.compareUrl}
                    onChange={(e) => fa.setCompareUrl(e.target.value)}
                    placeholder="https://www.warcraftlogs.com/reports/… or …/compare/…"
                    onKeyDown={(e) => e.key === 'Enter' && !fa.loading && fa.loadCompare()}
                />
            </FieldRow>
            <WclLoadStatus variant="nav" />
            {fa.soloPlayerChoices.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ ...s.label, marginBottom: 8 }}>
                        {fa.p1data && fa.soloFromReport
                            ? 'Switch character (solo)'
                            : 'Select character (solo)'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {fa.soloPlayerChoices.map((p) => {
                            const active = fa.soloRosterSelectedPlayerId === p.id
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={fa.loading}
                                    onClick={() => void fa.confirmSoloReportPlayer(String(p.id))}
                                    className={`${pa.rosterPick}${active ? ` ${pa.rosterPickActive}` : ''}`}
                                    title={`${p.role} · ${p.className}`}
                                >
                                    {p.iconUrl ? (
                                        <img
                                            src={p.iconUrl}
                                            alt=""
                                            width={24}
                                            height={24}
                                            style={{ borderRadius: 3, flexShrink: 0 }}
                                        />
                                    ) : (
                                        <span
                                            style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: 3,
                                                background: 'var(--bg4)',
                                                flexShrink: 0,
                                                display: 'inline-block',
                                            }}
                                        />
                                    )}
                                    <span>
                                        <span style={{ color: 'var(--gold2)', fontWeight: 600 }}>
                                            {p.name}
                                        </span>
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: 10,
                                                color: 'var(--dim)',
                                                marginTop: 2,
                                            }}
                                        >
                                            {p.specLabel}
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </Panel>
    )
}
