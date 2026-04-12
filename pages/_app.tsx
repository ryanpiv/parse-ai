import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { AppSessionProvider } from '../contexts/AppSessionContext'
import { AppNav } from '../components/AppNav'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppSessionProvider>
      <AppNav />
      <Component {...pageProps} />
    </AppSessionProvider>
  )
}
