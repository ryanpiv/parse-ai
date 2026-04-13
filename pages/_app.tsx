import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { AppSessionProvider } from '../contexts/AppSessionContext'
import { AnalyzePageCacheProvider } from '../contexts/AnalyzePageCacheContext'
import { AppNav } from '../components/AppNav'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppSessionProvider>
      <AnalyzePageCacheProvider>
        <AppNav />
        <Component {...pageProps} />
      </AnalyzePageCacheProvider>
    </AppSessionProvider>
  )
}
