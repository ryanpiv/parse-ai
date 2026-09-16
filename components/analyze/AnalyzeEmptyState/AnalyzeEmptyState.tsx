import Link from 'next/link'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { useFightAnalysis } from '../../../contexts/FightAnalysisContext'
import OrDivider from '../../ui/OrDivider'
import WclKeyPrompt from '../WclKeyPrompt'
import TopParseCompare from '../TopParseCompare'

export type AnalyzeEmptyStateProps = { mode: 'solo' | 'compare' }

const AnalyzeEmptyState = ({ mode }: AnalyzeEmptyStateProps) => {
    const fa = useFightAnalysis()
    const authNeeded = fa.authStatus === 'needed'
    const soloLoaded = Boolean(fa.p1data && fa.soloFromReport)

    return (
        <div className={ui.panel}>
            <div className={styles.title}>
                {mode === 'solo' ? 'No fight loaded' : 'Compare — two players needed'}
            </div>
            {authNeeded && <WclKeyPrompt />}
            <div className={styles.body}>
                {mode === 'solo' ? (
                    <>
                        <p className={styles.flushPara}>
                            <Link href="/reports" className={styles.reportsLink}>
                                Browse your logs on the Reports tab
                            </Link>{' '}
                            — pick a pull, pick a player.
                        </p>
                        <OrDivider />
                        <p className={styles.flushPara}>
                            Paste a Warcraft Logs URL below (needs{' '}
                            <code className={styles.codeBlue}>?fight=</code>) and click{' '}
                            <strong className={styles.strongText}>Load</strong>. Compare URLs work too.
                        </p>
                    </>
                ) : (
                    <>
                        {soloLoaded && (
                            <>
                                <p className={styles.leadPara}>
                                    Compare <strong>{fa.p1data?.name}</strong> against a world-ranked parse of
                                    the same spec.
                                </p>
                                <TopParseCompare />
                                <OrDivider />
                            </>
                        )}
                        <p className={styles.compareHintPara}>
                            Paste a Warcraft Logs <strong className={styles.strongText}>compare</strong> URL
                            below and click Load:
                        </p>
                        <p className={styles.compareUrlExample}>
                            /reports/compare/CODE1/CODE2?fight=12,5&source=1,2
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}

export default AnalyzeEmptyState
