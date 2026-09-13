import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { AppSessionProvider } from '../contexts/AppSessionContext'
import { AnalyzePageCacheProvider } from '../contexts/AnalyzePageCacheContext'
import { FightAnalysisProvider } from '../contexts/FightAnalysisContext'
import { AppNav } from '../components/AppNav'
import { AppErrorBoundary } from '../components/AppErrorBoundary'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppErrorBoundary>
      <AppSessionProvider>
        <AnalyzePageCacheProvider>
          <FightAnalysisProvider>
            <AppNav />
            <Component {...pageProps} />
          </FightAnalysisProvider>
        </AnalyzePageCacheProvider>
      </AppSessionProvider>
    </AppErrorBoundary>
  )
}
