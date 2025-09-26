"use client"

import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconPigMoney,
  IconCreditCard,
  IconCoins,
} from "@tabler/icons-react"

import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { useMetrics } from "@/lib/api"
import { useDateRange } from "@/contexts/date-range-context"
import { Skeleton } from "@/components/ui/skeleton"

function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SectionCards() {
  const { dateRange, formatDateForAPI } = useDateRange()
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to ? {
    from: formatDateForAPI(dateRange.from),
    to: formatDateForAPI(dateRange.to)
  } : undefined

  const { data: metrics, isLoading, error } = useMetrics(dateRangeForAPI)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden rounded-2xl border border-border bg-background/60 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="mt-4 h-9 w-24" />
            </CardHeader>
            <CardFooter className="pt-0">
              <Skeleton className="h-4 w-32" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="col-span-full p-6">
          <p className="text-center text-muted-foreground">
            Failed to load financial data. Please try again.
          </p>
        </Card>
      </div>
    )
  }

  const cards = [
    {
      label: "Balance",
      value: formatCurrency(metrics.balance),
      icon: <IconWallet className="size-6 text-muted-foreground" />,
      change: "+3.2%", // TODO: Calculate from historical data
      changeType: "up" as const,
      changeColor: "text-green-600",
      subtext: "compared to last period",
    },
    {
      label: "Income",
      value: formatCurrency(metrics.income),
      icon: <IconCoins className="size-6 text-muted-foreground" />,
      change: "+8.5%", // TODO: Calculate from historical data
      changeType: "up" as const,
      changeColor: "text-green-600",
      subtext: "compared to last period",
    },
    {
      label: "Expenses",
      value: formatCurrency(metrics.expenses),
      icon: <IconCreditCard className="size-6 text-muted-foreground" />,
      change: "-2.1%", // TODO: Calculate from historical data
      changeType: "down" as const,
      changeColor: "text-red-600",
      subtext: "compared to last period",
    },
    {
      label: "Savings",
      value: `${metrics.savingsRate.toFixed(1)}%`,
      icon: <IconPigMoney className="size-6 text-muted-foreground" />,
      change: "+5.0%", // TODO: Calculate from historical data
      changeType: "up" as const,
      changeColor: "text-green-600",
      subtext: "compared to last period",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="
            relative overflow-hidden rounded-2xl border border-border
            bg-background/60 shadow-none transition-shadow
            hover:shadow-sm
            before:absolute before:inset-0 before:rounded-[inherit]
            before:pointer-events-none
            before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_55%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]
            dark:before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_55%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]
          "
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-muted rounded-md p-1.5">{card.icon}</div>
              <CardDescription className="font-medium text-muted-foreground">
                {card.label}
              </CardDescription>
            </div>
            <CardTitle className="mt-4 text-3xl font-bold tabular-nums">
              {card.value}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0">
            <div className="flex items-center gap-1 text-sm">
              {card.changeType === "up" ? (
                <IconArrowUpRight className={`size-4 ${card.changeColor}`} />
              ) : (
                <IconArrowDownRight className={`size-4 ${card.changeColor}`} />
              )}
              <span className={`font-medium ${card.changeColor}`}>{card.change}</span>
              <span className="text-muted-foreground ml-1">{card.subtext}</span>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
