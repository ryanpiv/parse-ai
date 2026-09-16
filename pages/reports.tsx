import Head from 'next/head'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { ReportBrowser } from '../components/reports/ReportBrowser'
import { WclKeyPrompt } from '../components/analyze/WclKeyPrompt'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { s } from '../lib/styles'

/** Browse the signed-in user's WCL reports and jump straight into Analyze. */
export default function ReportsPage() {
    const fa = useFightAnalysis()
    return (
        <>
            <Head>
                <title>Reports · Parse Analyzer</title>
            </Head>
            <div style={s.wrap}>
                <PageHeader title="Reports" subtitle="browse your WarcraftLogs and jump into analysis" />
                {fa.authStatus === 'needed' && <WclKeyPrompt />}
                <Panel title="Your logs">
                    <ReportBrowser />
                </Panel>
            </div>
        </>
    )
}
