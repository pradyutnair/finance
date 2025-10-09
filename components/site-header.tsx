"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { DateRangePicker } from "./date-range-picker"
import { useDateRange, useCurrency } from "@/lib/stores"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePathname } from "next/navigation"

export function SiteHeader() {
  // Check if we're on dashboard page
  const pathname = usePathname()
  const isDashboard = pathname === "/dashboard"
  const isTransactions = pathname === "/transactions"
  const isBanks = pathname === "/banks"
  
  // Use Zustand stores
  const { dateRange, setDateRange } = useDateRange()
  const { baseCurrency, setBaseCurrency, preferredCurrencies } = useCurrency()

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
        </div>
      </div>
    </header>
  )
}
