import Head from 'next/head'
import PageHeader from '../components/ui/PageHeader'
import MoteTrainerGame from '../components/Trainer/MoteTrainerGame'
import { MOTE_NAME } from '../lib/moteTrainer/constants'
import ui from '../styles/ui.module.css'

const PAGE_TITLE = `${MOTE_NAME} trainer`

const TrainerPage = () => {
    return (
        <div className={ui.wrap}>
            <Head>
                <title>{PAGE_TITLE}</title>
            </Head>
            <PageHeader
                title={PAGE_TITLE}
                subtitle="Click a spell or press 1–5. Cooldowns are Shift+1–5."
            />
            <MoteTrainerGame />
        </div>
    )
}

export default TrainerPage
