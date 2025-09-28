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
import { Progress } from "@/components/ui/progress"
import { useCurrency } from "@/contexts/currency-context"

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
  const { baseCurrency, convertAmount, rates } = useCurrency()
  
  // Debug: log the currency context values
  console.log('SectionCards render - baseCurrency:', baseCurrency, 'rates loaded:', !!rates)
  
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
  const savingsTarget = 20 // %
  const savingsRate = metrics.savingsRate // e.g. 6.7 (%)
  const savingsProgress = Math.max(0, Math.min(100, (savingsRate / savingsTarget) * 100))
  // Debug: log the metrics values before conversion
  console.log('SectionCards - metrics:', { 
    balance: metrics?.balance, 
    income: metrics?.income, 
    expenses: metrics?.expenses 
  })

  // Test conversion directly
  const testConversion = convertAmount(1000, 'EUR', baseCurrency)
  console.log('Test conversion: 1000 EUR ->', testConversion, baseCurrency)

  const cards = [
    {
      label: "Balance",
      value: formatCurrency(convertAmount(metrics.balance || 0, 'EUR', baseCurrency), baseCurrency),
      icon: <IconWallet className="size-6 text-muted-foreground" />,
      delta: metrics.deltas?.balancePct ?? 0,
      kind: "balance" as const,
    },
    {
      label: "Income",
      value: formatCurrency(convertAmount(metrics.income || 0, 'EUR', baseCurrency), baseCurrency),
      icon: <IconCoins className="size-6 text-muted-foreground" />,
      delta: metrics.deltas?.incomePct ?? 0,
      kind: "income" as const,
    },
    {
      label: "Expenses",
      value: formatCurrency(convertAmount(metrics.expenses || 0, 'EUR', baseCurrency), baseCurrency),
      icon: <IconCreditCard className="size-6 text-muted-foreground" />,
      delta: metrics.deltas?.expensesPct ?? 0,
      kind: "expenses" as const,
    },
    {
      label: "Savings",
      // value is unused for savings now
      value: `${metrics.savingsRate.toFixed(1)}%`,
      icon: <IconPigMoney className="size-6 text-muted-foreground" />,
      delta: metrics.deltas?.savingsPct ?? 0,
      kind: "savings" as const,
      rate: savingsRate,
      progress: savingsProgress,
    }
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

          {card.kind !== "savings" ? (
            // --- Income / Expenses / Balance (delta below value) ---
            <div className="mt-4 flex flex-col items-start">
              <CardTitle
                  className="
                    text-3xl font-bold tabular-nums 
                    text-[#40221a]
                    dark:text-white
                  "
                >
                  {card.value}
                </CardTitle>

              {(() => {
                const d = Number(card.delta || 0)
                const ad = Math.abs(d)
                const disp = `${isFinite(ad) ? ad.toFixed(1) : "0.0"}%`
                const isZero = Math.round(d * 10) === 0
                const isPos = d > 0
                const isExpenses = card.kind === "expenses"
                const color = isZero
                  ? "text-muted-foreground"
                  : isExpenses
                    ? (isPos ? "text-red-600" : "text-green-600")
                    : (isPos ? "text-green-600" : "text-red-600")
                return (
                  <div className="flex items-center gap-1 text-sm mt-1">
                    {!isZero &&
                      (isPos ? (
                        <IconArrowUpRight className={`size-4 ${color}`} />
                      ) : (
                        <IconArrowDownRight className={`size-4 ${color}`} />
                      ))}
                    <span className={`font-medium ${color}`}>{disp}</span>
                  </div>
                )
              })()}
            </div>
          ) : (
            // --- Savings: show percent like other cards + minimal progress ---
            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-3xl font-bold tabular-nums text-[#40221a] dark:text-white">
                  {card.value}
                </CardTitle>
                {/* {(() => {
                  const d = Number(card.delta || 0)
                  const ad = Math.abs(d)
                  const disp = `${isFinite(ad) ? ad.toFixed(1) : "0.0"}%`
                  const isZero = Math.round(d * 10) === 0
                  const isPos = d > 0
                  const color = isZero
                    ? "text-muted-foreground"
                    : (isPos ? "text-green-600" : "text-red-600")
                  return (
                    <div className="flex items-center gap-1 text-sm">
                      {!isZero &&
                        (isPos ? (
                          <IconArrowUpRight className={`size-4 ${color}`} />
                        ) : (
                          <IconArrowDownRight className={`size-4 ${color}`} />
                        ))}
                      <span className={`font-medium ${color}`}></span>
                    </div>
                  )
                })()} */}
              </div>
              <Progress value={card.progress} className="h-2 mt-3 opacity-60" />
            </div>
          )}
        </CardHeader>
        </Card>
      ))}
    </div>
  )
}
