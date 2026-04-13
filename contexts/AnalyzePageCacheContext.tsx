import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import type { AnalyzedFightData } from '../lib/fightAnalysis'

export type AnalyzePageSnapshot = {
  compareUrl: string
  status: { type: string; msg: string } | null
  loadStep: string
  p1data: AnalyzedFightData | null
  p2data: AnalyzedFightData | null
  spellRows: unknown[]
  talentDiff: unknown | null
  messages: Array<{ role: string; content: string }>
  bossName: string
  fightKill1: boolean
  fightKill2: boolean
}

type Ctx = {
  save: (s: AnalyzePageSnapshot) => void
  read: () => AnalyzePageSnapshot | null
}

const AnalyzePageCacheContext = createContext<Ctx | null>(null)

/**
 * In-memory snapshot of the Analyze (/) page so navigating to Compare / P1 talents
 * and back does not wipe loaded fight data. Clears on full page refresh.
 */
export function AnalyzePageCacheProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AnalyzePageSnapshot | null>(null)
  const save = useCallback((s: AnalyzePageSnapshot) => {
    const prev = ref.current
    // Never replace a completed analysis with an empty snapshot (e.g. initial mount or mid-load clears).
    if (prev?.p1data && prev?.p2data && !s.p1data && !s.p2data) return
    ref.current = s
  }, [])
  const read = useCallback(() => ref.current, [])
  const value = useMemo(() => ({ save, read }), [save, read])
  return (
    <AnalyzePageCacheContext.Provider value={value}>{children}</AnalyzePageCacheContext.Provider>
  )
}

export function useAnalyzePageCache() {
  const c = useContext(AnalyzePageCacheContext)
  if (!c) throw new Error('useAnalyzePageCache must be used within AnalyzePageCacheProvider')
  return c
}
