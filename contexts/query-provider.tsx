"use client"

import { QueryClient, QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

const STORAGE_KEY = "nexpass_rq_cache_v1"
const SAVE_THROTTLE_MS = 1500

function loadPersistedState(): unknown | null {
  try {
    if (typeof window === "undefined") return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          // Prefer cache to reduce DB reads via API routes
          staleTime: 5 * 60 * 1000, // 5 min default
          gcTime: 24 * 60 * 60 * 1000, // 24 hours in cache
          retry: 1,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          refetchOnMount: false,
        },
      },
    })
  )

  // Hydrate from localStorage once on mount
  const hydratedRef = useRef(false)
  const [isRestored, setIsRestored] = useState(false)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const persisted = loadPersistedState()
    if (persisted) {
      try {
        hydrate(queryClient, persisted as any)
      } catch {
        // ignore corrupt cache
      }
    }
    // Set sensible per-key defaults to further reduce refetching
    const set = queryClient.setQueryDefaults.bind(queryClient)
    set(["session"], { staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["metrics"], { staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["timeseries"], { staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    // Reduce caching for transactions to avoid stale UI during debugging
    set(["transactions"], { staleTime: 0, gcTime: 5 * 60 * 1000, refetchOnMount: true })
    set(["categories"], { staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["accounts"], { staleTime: 10 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["institutions"], { staleTime: 12 * 60 * 60 * 1000, gcTime: 2 * 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["requisition"], { staleTime: 10 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["account-details"], { staleTime: 10 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    set(["account-transactions"], { staleTime: 10 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, refetchOnMount: false })
    setIsRestored(true)
  }, [queryClient])

  // Persist on query cache changes (throttled)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = useMemo(() => (
    () => {
      if (saveTimer.current) return
      saveTimer.current = setTimeout(() => {
        try {
          const dehydrated = dehydrate(queryClient, {
            shouldDehydrateQuery: (q) => {
              // Only persist successful data for specific keys to keep storage small
              const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined
              const allowed = [
                "session",
                "metrics",
                "timeseries",
                "transactions",
                "categories",
                "accounts",
                "institutions",
                "requisition",
                "account-details",
                "account-transactions",
              ]
              return q.state.status === "success" && typeof key0 === "string" && allowed.includes(key0)
            },
          })
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dehydrated))
          }
        } catch {
          // ignore serialize errors
        } finally {
          if (saveTimer.current) {
            clearTimeout(saveTimer.current)
            saveTimer.current = null
          }
        }
      }, SAVE_THROTTLE_MS)
    }
  ), [queryClient])

  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe(() => {
      scheduleSave()
    })
    return () => {
      unsub()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [queryClient, scheduleSave])

  return (
    <QueryClientProvider client={queryClient}>
      {isRestored ? children : null}
    </QueryClientProvider>
  )
}
