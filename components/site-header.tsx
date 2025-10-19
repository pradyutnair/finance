"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { DateRangePicker } from "./date-range-picker"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname } from "next/navigation"
import { useContext, useState } from "react"
import { DateRangeContext } from "@/contexts/date-range-context"
import { useQueryClient } from "@tanstack/react-query"
import { IconRefresh } from "@tabler/icons-react"

export function SiteHeader() {
  // Check if we're on dashboard page and if DateRangeContext is available
  const pathname = usePathname()
  const isDashboard = pathname === "/dashboard"
  const isTransactions = pathname === "/transactions"
  const isBanks = pathname === "/banks"
  const dateRangeContext = useContext(DateRangeContext)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const queryClient = useQueryClient()

  // Only use date range if we're on dashboard and context is available
  const dateRange = dateRangeContext?.dateRange
  const setDateRange = dateRangeContext?.setDateRange

  const { baseCurrency, setBaseCurrency, preferredCurrencies } = useCurrency()

  const clearAllCaches = async () => {
    if (!confirm('This will clear all caches and refresh dashboard data. Continue?')) {
      return
    }

    setIsClearingCache(true)

    // Preserve essential user data before clearing
    console.log('💾 Preserving essential user data...')

    // Get theme before clearing (next-themes uses 'theme' key)
    const theme = localStorage.getItem('theme')
    const appwriteSession = localStorage.getItem('appwrite-session')
    const sidebarState = localStorage.getItem('sidebar_state')

    // Also check for any theme-related keys
    const allKeys = Object.keys(localStorage)
    const themeRelatedKeys = allKeys.filter(key =>
      key.includes('theme') || key.includes('color') || key.includes('dark') || key.includes('light')
    )

    const preservedThemeData: Record<string, string | null> = {}
    themeRelatedKeys.forEach(key => {
      preservedThemeData[key] = localStorage.getItem(key)
    })

    // Clear browser storage selectively (skip session storage to avoid auth issues)
    console.log('🧹 Clearing browser storage...')
    const keysToPreserve = [
      'appwrite-session',
      'sidebar_state',
      ...themeRelatedKeys
    ]

    Object.keys(localStorage).forEach(key => {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key)
      }
    })

    // Clear sessionStorage but preserve session-related items
    const sessionStorageKeys = Object.keys(sessionStorage)
    sessionStorageKeys.forEach(key => {
      if (!key.includes('session') && !key.includes('auth')) {
        sessionStorage.removeItem(key)
      }
    })

    // Clear service worker caches if available
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
        console.log('🧹 Cleared service worker caches:', cacheNames)
      } catch (error) {
        console.warn('⚠️ Could not clear service worker caches:', error)
      }
    }

    // Skip server cache invalidation to avoid auth issues during client-side cache clearing
    console.log('🧹 Skipping server cache invalidation to avoid authentication conflicts...')

    // Clear React Query client cache directly
    console.log('🧹 Clearing client-side caches...')
    try {
      // Clear all React Query queries and caches
      await queryClient.invalidateQueries()
      queryClient.clear()

      // Clear any remaining localStorage cache items (except preserved ones)
      Object.keys(localStorage).forEach(key => {
        if (key.includes('cache') || key.includes('query') || key.includes('rq_')) {
          if (!key.includes('theme')) {
            localStorage.removeItem(key)
          }
        }
      })

      console.log('✅ Client caches cleared successfully')
    } catch (error) {
      console.warn('⚠️ Error clearing client caches:', error)
      // Continue anyway - other cache clearing methods should work
    }

    // Restore theme data first
    console.log('🔄 Restoring theme data...')
    if (theme) {
      localStorage.setItem('theme', theme)
    }

    // Restore any other theme-related data
    Object.keys(preservedThemeData).forEach(key => {
      if (preservedThemeData[key]) {
        localStorage.setItem(key, preservedThemeData[key]!)
      }
    })

    // Restore other essential user data
    if (appwriteSession) {
      localStorage.setItem('appwrite-session', appwriteSession)
    }
    if (sidebarState) {
      localStorage.setItem('sidebar_state', sidebarState)
    }

    // Force a hard reload to clear all HTTP caches
    console.log('🔄 Reloading page...')
    window.location.reload()
  }

  // Get page title based on pathname
  const getPageTitle = () => {
    switch (pathname) {
      case "/dashboard":
        return "Dashboard"
      case "/banks":
        return "Banks"
      case "/transactions":
        return "Transactions"
      case "/profile":
        return "Profile"
      default:
        return "Dashboard"
    }
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{getPageTitle()}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger size="sm" aria-label="Select base currency">
              <SelectValue placeholder="EUR" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {preferredCurrencies.map((c) => (
                <SelectItem key={c} value={c} className="rounded-lg">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(isDashboard || isTransactions || isBanks) && dateRange && setDateRange && (
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
            />
          )}
          <ThemeToggle />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={clearAllCaches}
                  disabled={isClearingCache}
                  className="h-9 w-9"
                >
                  <IconRefresh className={`h-4 w-4 ${isClearingCache ? 'animate-spin' : ''}`} />
                  <span className="sr-only">Reset caches</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear all caches and refresh dashboard data</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  )
}
