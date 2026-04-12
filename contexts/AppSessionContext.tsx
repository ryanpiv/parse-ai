import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'parse-analyzer-app-session'

export type AppSessionSnapshot = {
  wclCompareUrl: string
  compareStr1: string
  compareStr2: string
  compareName1: string
  compareName2: string
  compareWclUrl: string
  specId: number | null
  /** JSON array of { nodeID, rank } from WCL CombatantInfo — used on /talent-preview for accurate hero/class/spec. */
  p1TalentTreeJson: string
}

const defaultSnapshot: AppSessionSnapshot = {
  wclCompareUrl: '',
  compareStr1: '',
  compareStr2: '',
  compareName1: 'Build 1',
  compareName2: 'Build 2',
  compareWclUrl: '',
  specId: null,
  p1TalentTreeJson: '',
}

type Ctx = {
  hydrated: boolean
  session: AppSessionSnapshot
  patchSession: (p: Partial<AppSessionSnapshot>) => void
}

const AppSessionContext = createContext<Ctx | null>(null)

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [session, setSession] = useState<AppSessionSnapshot>(defaultSnapshot)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Partial<AppSessionSnapshot>
        setSession({ ...defaultSnapshot, ...p })
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  const patchSession = useCallback((p: Partial<AppSessionSnapshot>) => {
    setSession(prev => {
      const next = { ...prev, ...p }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
      }, 250)
      return next
    })
  }, [])

  return (
    <AppSessionContext.Provider value={{ hydrated, session, patchSession }}>
      {children}
    </AppSessionContext.Provider>
  )
}

export function useAppSession(): Ctx {
  const c = useContext(AppSessionContext)
  if (!c) throw new Error('useAppSession must be used within AppSessionProvider')
  return c
}
