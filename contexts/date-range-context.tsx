"use client"

import React, { createContext, useContext, useState } from "react"
import { DateRange } from "react-day-picker"
import { subDays } from "date-fns"

interface DateRangeContextType {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  formatDateForAPI: (date: Date) => string
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0] // YYYY-MM-DD format
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
