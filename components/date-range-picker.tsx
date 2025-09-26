"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  className?: string
  date?: DateRange
  onDateChange?: (date: DateRange | undefined) => void
}

const presetRanges = [
  {
    label: "Today",
    getValue: () => ({
      from: new Date(),
      to: new Date(),
    }),
  },
  {
    label: "Yesterday",
    getValue: () => {
      const yesterday = subDays(new Date(), 1)
      return {
        from: yesterday,
        to: yesterday,
      }
    },
  },
  {
    label: "This Week",
    getValue: () => ({
      from: startOfWeek(new Date()),
      to: endOfWeek(new Date()),
    }),
  },
  {
    label: "Last 7 Days",
    getValue: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  {
    label: "Last 28 Days",
    getValue: () => ({
      from: subDays(new Date(), 27),
      to: new Date(),
    }),
  },
  {
    label: "This Month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  {
    label: "Last Month",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
  {
    label: "This Year",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
]

export function DateRangePicker({ className, date, onDateChange }: DateRangePickerProps) {
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>(date)
  const [month, setMonth] = React.useState<Date>(new Date())

  React.useEffect(() => {
    setSelectedRange(date)
  }, [date])

  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range) {
      setSelectedRange(undefined)
      onDateChange?.(undefined)
      return
    }

    // If both from and to are set, this is a complete range
    if (range.from && range.to) {
      setSelectedRange(range)
      onDateChange?.(range)
    }
    // If only from is set, this is the start of a new selection
    else if (range.from && !range.to) {
      setSelectedRange({ from: range.from, to: undefined })
      onDateChange?.({ from: range.from, to: undefined })
    }
    // Handle any other edge cases by clearing the selection
    else {
      setSelectedRange(undefined)
      onDateChange?.(undefined)
    }
  }

  const handlePresetSelect = (preset: (typeof presetRanges)[0]) => {
    const range = preset.getValue()
    handleDateSelect(range)
    if (range.from) {
      setMonth(range.from)
    }
  }

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return "Pick a date"
    if (!range.to) return format(range.from, "d MMM yyyy")
    return `${format(range.from, "d MMM yyyy")} - ${format(range.to, "d MMM yyyy")}`
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full max-w-[280px] sm:max-w-[320px] justify-center text-center font-normal bg-muted/50 border-border px-3 py-2",
              !selectedRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">{formatDateRange(selectedRange)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background border-border" align="center" side="bottom">
          <div className="flex flex-col sm:flex-row">
            {/* Preset Options Sidebar */}
            <div className="flex flex-row sm:flex-col border-b sm:border-b-0 sm:border-r border-border bg-muted/20 p-1 sm:p-2 min-w-full sm:min-w-[140px] overflow-x-auto sm:overflow-x-visible">
              <div className="flex flex-row sm:flex-col gap-1 sm:gap-0 min-w-max sm:min-w-0">
                {presetRanges.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    className="justify-start text-sm font-normal h-8 px-3 sm:px-2 whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="p-3 sm:p-4">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={month}
                month={month}
                onMonthChange={setMonth}
                selected={selectedRange}
                onSelect={handleDateSelect}
                numberOfMonths={1}
                className="p-0"
                key={selectedRange?.from?.getTime() || "no-selection"}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
