"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import CalendarRangeCalendarMultiMonthDemo from "./multi-calendar"
import DateRangePicker from "./ui/date-range-picker"
import { ThemeToggle } from "./theme-toggle"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Documents</h1>
        <div className="ml-auto flex items-center gap-2">
        <DateRangePicker
            onUpdate={(values) => console.log(values)}
            initialDateFrom={new Date()}
            initialDateTo={new Date()}
            align="start"
            locale="en-GB"
            showCompare={false}
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
