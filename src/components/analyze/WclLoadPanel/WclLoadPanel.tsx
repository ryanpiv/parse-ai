import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { useFightAnalysis } from '../../../contexts/FightAnalysisContext'
import FieldRow from '../../ui/FieldRow'
import Panel from '../../ui/Panel'
import WclLoadStatus from '../../WclLoadStatus'

/** Analyze entry point: WCL report/compare URL + Load, status alerts, and the solo roster picker. */
const WclLoadPanel = () => {
    const fa = useFightAnalysis()
    const canOpen = Boolean(fa.p1data) && Boolean(fa.compareUrl.trim())

    return (
        <Panel title="Warcraft Logs">
            <FieldRow
                label="Report or compare URL"
                action={
                    <div className={styles.loadActions}>
                        <button
                            type="button"
                            className={ui.btnGold}
                            disabled={fa.loading}
                            aria-busy={fa.loading}
                            onClick={() => void fa.loadCompare()}
                        >
                            {fa.loading ? fa.loadStep || 'Loading...' : 'Load'}
                        </button>
                        <button
                            type="button"
                            className={ui.btnGhost}
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
                    className={ui.input}
                    value={fa.compareUrl}
                    onChange={(e) => fa.setCompareUrl(e.target.value)}
                    placeholder="https://www.warcraftlogs.com/reports/… or …/compare/…"
                    onKeyDown={(e) => e.key === 'Enter' && !fa.loading && fa.loadCompare()}
                />
            </FieldRow>
            <WclLoadStatus variant="nav" />
            {fa.soloPlayerChoices.length > 0 && (
                <div className={styles.rosterSection}>
                    <div className={`${ui.label} ${styles.rosterLabel}`}>
                        {fa.p1data && fa.soloFromReport
                            ? 'Switch character (solo)'
                            : 'Select character (solo)'}
                    </div>
                    <div className={styles.rosterGrid}>
                        {fa.soloPlayerChoices.map((p) => {
                            const active = fa.soloRosterSelectedPlayerId === p.id
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={fa.loading}
                                    onClick={() => void fa.confirmSoloReportPlayer(String(p.id))}
                                    className={`${ui.rosterPick}${active ? ` ${ui.rosterPickActive}` : ''}`}
                                    title={`${p.role} · ${p.className}`}
                                >
                                    {p.iconUrl ? (
                                        <img
                                            src={p.iconUrl}
                                            alt=""
                                            width={24}
                                            height={24}
                                            className={styles.rosterIcon}
                                        />
                                    ) : (
                                        <span className={styles.rosterIconPlaceholder} />
                                    )}
                                    <span>
                                        <span className={styles.rosterName}>{p.name}</span>
                                        <span className={styles.rosterSpec}>{p.specLabel}</span>
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

export default WclLoadPanel
