import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'

export type CollapsibleBridgeApi = {
  expandAll: () => void
  collapseAll: () => void
}

type CollapsibleGroupValue = {
  register: (setOpen: Dispatch<SetStateAction<boolean>>) => () => void
  expandAll: () => void
  collapseAll: () => void
}

const CollapsibleGroupContext = createContext<CollapsibleGroupValue | null>(null)

export function CollapsibleGroupProvider({
  bridgeRef,
  children,
}: {
  bridgeRef?: MutableRefObject<CollapsibleBridgeApi | null>
  children: ReactNode
}) {
  const settersRef = useRef(new Set<Dispatch<SetStateAction<boolean>>>())

  const register = useCallback((setOpen: Dispatch<SetStateAction<boolean>>) => {
    settersRef.current.add(setOpen)
    return () => {
      settersRef.current.delete(setOpen)
    }
  }, [])

  const expandAll = useCallback(() => {
    settersRef.current.forEach(fn => {
      fn(true)
    })
  }, [])

  const collapseAll = useCallback(() => {
    settersRef.current.forEach(fn => {
      fn(false)
    })
  }, [])

  useEffect(() => {
    if (!bridgeRef) return
    bridgeRef.current = { expandAll, collapseAll }
    return () => {
      bridgeRef.current = null
    }
  }, [bridgeRef, expandAll, collapseAll])

  const value = useMemo(
    () => ({ register, expandAll, collapseAll }),
    [register, expandAll, collapseAll]
  )

  return <CollapsibleGroupContext.Provider value={value}>{children}</CollapsibleGroupContext.Provider>
}

/** Register a CollapsibleSection’s setOpen with the nearest provider (no-op if none). */
export function useRegisterCollapsible(setOpen: Dispatch<SetStateAction<boolean>>) {
  const ctx = useContext(CollapsibleGroupContext)
  useEffect(() => {
    if (!ctx) return
    return ctx.register(setOpen)
  }, [ctx, setOpen])
}
