"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { DateRange } from "react-day-picker"
import { startOfMonth } from "date-fns"

interface DateRangeContextType {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  formatDateForAPI: (date: Date) => string
}

export const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  // Default to current month
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem("nexpass_date_range_v1")
        if (raw) {
          const parsed = JSON.parse(raw)
          const from = parsed?.from ? new Date(parsed.from) : startOfMonth(new Date())
          const to = parsed?.to ? new Date(parsed.to) : new Date()
          return { from, to }
        }
      }
    } catch {}
    return {
      from: startOfMonth(new Date()),
      to: new Date(),
    }
  })

  // Persist to localStorage on change
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && dateRange) {
        window.localStorage.setItem(
          "nexpass_date_range_v1",
          JSON.stringify({
            from: dateRange.from ? dateRange.from.toISOString() : null,
            to: dateRange.to ? dateRange.to.toISOString() : null,
          })
        )
      }
    } catch {}
  }, [dateRange])

  const formatDateForAPI = (date: Date) => {
    // Format using local calendar date to avoid UTC shift (off-by-one)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, formatDateForAPI }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const context = useContext(DateRangeContext)
  if (context === undefined) {
    throw new Error("useDateRange must be used within a DateRangeProvider")
  }
  return context
}
