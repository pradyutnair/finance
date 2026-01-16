"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter, Calendar, TrendingDown, CreditCard, AlertCircle, CheckCircle2, Zap, X, PieChart as PieChartIcon } from "lucide-react"
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTransactions, useUpdateTransaction } from "@/lib/api"
import { detectRecurringTransactions, type RecurringTransaction } from "@/lib/recurring-transactions"
import { useCurrency } from "@/contexts/currency-context"
import { CATEGORY_OPTIONS, getCategoryColor } from "@/lib/categories"
import { toast } from "sonner"
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts"

type RecurringRow = RecurringTransaction

const ordinalSuffix = (n: number): string => {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function RecurringTransactionsTable() {
  const pageSize = 15
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })
  const [sorting, setSorting] = useState<SortingState>([{ id: "avgAmount", desc: true }])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [minCount, setMinCount] = useState<number>(2)
  const { baseCurrency, convertAmount, getCurrencySymbol, formatAmount } = useCurrency()
  const updateTx = useUpdateTransaction()

  // Fetch ALL transactions to detect recurring ones (including excluded transactions)
  const { data: allTransactionsData, isLoading, error } = useTransactions({
    all: true,
    includeExcluded: true
  })

  // Detect recurring transactions from all transactions
  const allRecurringTransactions = useMemo(() => {
    if (!allTransactionsData?.transactions) return []
    return detectRecurringTransactions(allTransactionsData.transactions)
  }, [allTransactionsData])

  // Filter by search, category, and minimum count
  const filteredRecurring = useMemo(() => {
    return allRecurringTransactions.filter((rt) => {
      const matchesSearch = searchQuery === "" ||
        rt.counterparty.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === "all" || rt.category === categoryFilter
      const matchesCount = rt.count >= minCount
      return matchesSearch && matchesCategory && matchesCount
    })
  }, [allRecurringTransactions, searchQuery, categoryFilter, minCount])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalMonthlySpending = filteredRecurring.reduce((sum, rt) => {
      return sum + Math.abs(convertAmount(rt.avgAmount, rt.currency, baseCurrency))
    }, 0)

    const totalTransactions = filteredRecurring.reduce((sum, rt) => sum + rt.count, 0)

    const categoryBreakdown = filteredRecurring.reduce((acc, rt) => {
      const cat = rt.category || "Uncategorized"
      const amount = Math.abs(convertAmount(rt.avgAmount, rt.currency, baseCurrency))
      acc[cat] = (acc[cat] || 0) + amount
      return acc
    }, {} as Record<string, number>)

    return {
      totalMonthlySpending,
      totalRecurringTransactions: filteredRecurring.length,
      totalTransactions,
      categoryBreakdown,
    }
  }, [filteredRecurring, baseCurrency, convertAmount])

  // Handle marking all transactions in a recurring group as "not recurring"
  function handleMarkAllAsNotRecurring(recurringTx: RecurringTransaction) {
    const transactionIds = recurringTx.transactions.map(tx => tx.id).filter(Boolean)

    transactionIds.forEach(id => {
      updateTx.mutate({ id, isNotRecurring: true })
    })

    toast.success(`Marked "${recurringTx.counterparty}" as not recurring`, {
      description: `${transactionIds.length} transactions will not be detected as recurring anymore`,
    })
  }

  const columns: ColumnDef<RecurringRow>[] = useMemo(
    () => [
      {
        accessorKey: "counterparty",
        header: "Payee",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-sm text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">{row.original.counterparty}</span>
          </div>
        ),
      },
      {
        accessorKey: "avgAmount",
        header: () => <div className="text-right">Monthly</div>,
        cell: ({ row }) => {
          const original = convertAmount(row.original.avgAmount, row.original.currency, baseCurrency)
          const isIncome = original > 0
          const formatted = formatAmount(Math.abs(original))
          return (
            <div className="text-right">
              <div className={`font-bold ${isIncome ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"}`}>
                {isIncome ? "+" : "-"}{formatted}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getCategoryColor(row.original.category) }}
            />
            <span className="text-xs font-medium">{row.original.category}</span>
          </div>
        ),
      },
      {
        accessorKey: "count",
        header: () => <div className="text-center">Frequency</div>,
        cell: ({ row }) => (
          <div className="flex flex-col items-center gap-1">
            <Badge variant="outline" className="text-xs border-[var(--chocolate-brown)]/30 text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">
              {row.original.count}x
            </Badge>
            <span className="text-xs text-muted-foreground">
              {ordinalSuffix(row.original.dayOfMonth)}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMarkAllAsNotRecurring(row.original)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
        ),
        enableSorting: false,
      },
    ],
    [baseCurrency, convertAmount, formatAmount, updateTx]
  )

  const table = useReactTable({
    data: filteredRecurring,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { pagination, sorting },
    manualPagination: false,
    pageCount: Math.max(1, Math.ceil(filteredRecurring.length / pageSize)),
  })

  const rowsToRender = table.getRowModel().rows

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted/50 animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 bg-muted/50 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-border/50">
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Analyzing recurring transactions...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <div className="font-semibold text-lg mb-2">Failed to load transactions</div>
            <div className="text-sm text-muted-foreground mb-4">Please try refreshing the page</div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (filteredRecurring.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <CheckCircle2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <div className="font-semibold text-lg mb-2">No recurring transactions found</div>
            <div className="text-sm text-muted-foreground mb-6">
              {allRecurringTransactions.length > 0
                ? "Try adjusting your filters to see more results"
                : "Transactions that occur on the same day each month will appear here"
              }
            </div>
            {allRecurringTransactions.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setCategoryFilter("all")
                  setMinCount(2)
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalCount = filteredRecurring.length
  const offset = pagination.pageIndex * pagination.pageSize

  return (
    <div className="space-y-6">
      {/* Summary Statistics - Now 4 cards in one row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-gradient-to-br from-[var(--chocolate-gradient-start)]/5 to-[var(--chocolate-gradient-end)]/5 dark:from-[var(--chocolate-gradient-start)]/10 dark:to-[var(--chocolate-gradient-end)]/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">Monthly Recurring Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl font-bold text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">
              {formatAmount(summaryStats.totalMonthlySpending)}
            </CardTitle>
          </CardContent>
        </Card>

        <Card className="border-border bg-gradient-to-br from-[var(--chocolate-gradient-start)]/5 to-[var(--chocolate-gradient-end)]/5 dark:from-[var(--chocolate-gradient-start)]/10 dark:to-[var(--chocolate-gradient-end)]/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">Recurring Transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl font-bold text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">
              {summaryStats.totalRecurringTransactions}
            </CardTitle>
          </CardContent>
        </Card>

        <Card className="border-border bg-gradient-to-br from-[var(--chocolate-gradient-start)]/5 to-[var(--chocolate-gradient-end)]/5 dark:from-[var(--chocolate-gradient-start)]/10 dark:to-[var(--chocolate-gradient-end)]/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">Total Occurrences</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl font-bold text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]">
              {summaryStats.totalTransactions}
            </CardTitle>
          </CardContent>
        </Card>

        {/* Category Breakdown Card - Now part of the row */}
        {Object.keys(summaryStats.categoryBreakdown).length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-[var(--chocolate-brown)] dark:text-[var(--chocolate-brown-foreground)]" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="relative h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: data.fill }}
                                />
                                <span className="text-sm font-medium">{data.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatAmount(data.value)} ({data.percent.toFixed(1)}%)
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Pie
                      data={Object.entries(summaryStats.categoryBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([category, amount]) => ({
                          name: category,
                          value: amount,
                          percent: (amount / summaryStats.totalMonthlySpending) * 100,
                          fill: getCategoryColor(category),
                        }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {Object.entries(summaryStats.categoryBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([category, amount]) => (
                          <Cell key={category} fill={getCategoryColor(category)} />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Table */}
      <Card className="border-border/50 overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-muted/30 border-b">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
            <div className="relative flex-1 sm:flex-initial max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full pl-9 bg-background/50 border-border/50 focus:bg-background"
              />
            </div>

            <Input
              type="number"
              placeholder="Min occurrences"
              value={minCount}
              onChange={(e) => setMinCount(Math.max(2, parseInt(e.target.value) || 2))}
              className="h-9 w-36 bg-background/50 border-border/50 focus:bg-background"
              min={2}
            />

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 px-3 bg-background/50 border border-border/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Categories</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{totalCount} recurring</span>
            <span>•</span>
            <span>{summaryStats.totalTransactions} total</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50 bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-muted-foreground h-11 text-xs font-semibold uppercase tracking-wider cursor-pointer first:pl-6"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronLeft className="h-3 w-3 rotate-90" />,
                            desc: <ChevronRight className="h-3 w-3 rotate-90" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rowsToRender?.length ? (
                rowsToRender.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/20 transition-colors border-border/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="first:pl-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Search className="h-8 w-8 mb-2 opacity-50" />
                      <div className="font-medium">No results match your filters</div>
                      <div className="text-sm">Try adjusting your search or filters</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/10 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1} to {Math.min(offset + pageSize, totalCount)} of {totalCount} recurring transactions
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
