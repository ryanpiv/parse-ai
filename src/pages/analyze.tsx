import { useEffect } from 'react'
import { useRouter } from 'next/router'
import styles from '../styles/pages/analyze.module.css'

/** @deprecated Use `/` — Analyze lives on the home page with Solo | Compare subtabs. */
const AnalyzeRedirectPage = () => {
    const router = useRouter()
    useEffect(() => {
        void router.replace('/')
    }, [router])
    return <div className={styles.redirectNote}>Redirecting…</div>
}

export default AnalyzeRedirectPage
