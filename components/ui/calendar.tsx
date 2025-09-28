"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header: cn(
          "select-none w-(--cell-size)",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          defaultClassNames.week_number
        ),
        day: cn(
          "relative w-full h-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-md light:bg-chart-1",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // Highlight single selected day with chart-1 background and primary foreground
        "data-[selected-single=true]:bg-[--chart-1]", // single selected day background
        "data-[selected-single=true]:text-primary-foreground", // single selected day text color

        // Highlight days in the middle of a range with accent color
        "data-[range-middle=true]:bg-chart-1/70", // range middle background (light)
        "dark:data-[range-middle=true]:bg-accent", // range middle background (dark)
        //"data-[range-middle=true]:bg-chart-1/40", // range middle background
        "data-[range-middle=true]:text-accent-foreground", // range middle text color

        // Highlight range start with chart-1/80 background and primary foreground
        "data-[range-start=true]:bg-chart-1", // range start background
        "data-[range-start=true]:text-primary-foreground", // range start text color

        // Highlight range end with chart-1/80 background and primary foreground
        "data-[range-end=true]:bg-chart-1", // range end background
        "data-[range-end=true]:text-primary-foreground", // range end text color

        // Dark mode: override backgrounds for selected, range start, and range end
        "dark:data-[selected-single=true]:bg-primary", // dark mode single selected
        "dark:data-[range-start=true]:bg-primary", // dark mode range start
        "dark:data-[range-end=true]:bg-primary", // dark mode range end

        // Focused day: border and ring
        "group-data-[focused=true]/day:border-ring", // border on focused day
        "group-data-[focused=true]/day:ring-ring", // ring color on focused day

        // Dark mode: hover text color for accent foreground
        //"dark:hover:text-accent-foreground", // dark mode hover text

        // Layout and sizing
        "flex", // flex layout
        "aspect-square", // square aspect ratio
        "size-auto", // auto size
        "w-full", // full width
        "min-w-(--cell-size)", // minimum width from CSS variable
        "flex-col", // flex direction column
        "gap-1", // gap between elements
        "leading-none", // no extra line height
        "font-normal", // normal font weight

        // Focused day: relative positioning, z-index, and ring thickness
        "group-data-[focused=true]/day:relative", // relative position for focused
        "group-data-[focused=true]/day:z-10", // z-index for focused
        "group-data-[focused=true]/day:ring-[3px]", // ring thickness for focused

        // Range border radius and increased size for selected start/end dates
        "data-[range-end=true]:rounded-md", // rounded for range end
        "data-[range-end=true]:rounded-r-md", // rounded right for range end
        "data-[range-middle=true]:rounded-none", // no rounding for range middle
        "data-[range-start=true]:rounded-md", // rounded for range start
        "data-[range-start=true]:rounded-l-md", // rounded left for range start

        // Increase size for selected start and end dates
        "data-[range-start=true]:scale-110", // scale up start date
        "data-[range-end=true]:scale-110",   // scale up end date
        "transition-transform",              // smooth scaling transition

        // Child span styling
        "[&>span]:text-xs", // child span text size
        "[&>span]:opacity-70", // child span opacity
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
