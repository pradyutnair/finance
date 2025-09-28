"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, MoreVertical, ChevronsLeft, ChevronsRight, Search, Filter, X, Zap, Sparkles } from "lucide-react"
import type { ColumnDef, PaginationState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTransactions } from "@/lib/api"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"
import { useUpdateTransaction } from "@/lib/api"
import { useAutoCategorize } from "@/lib/api"
import { CATEGORY_OPTIONS } from "@/lib/categories"

type TxRow = {
  id: string
  description: string
  bankName: string
  category: string
  bookingDate: string
  amount: number
  currency: string
  accountId?: string
  exclude?: boolean
}

function RowActions({ onCategorize }: { onCategorize: (category: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex">
          <Button size="icon" variant="ghost" className="rounded-full p-2 hover:bg-muted/50" aria-label="Row actions">
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          {CATEGORY_OPTIONS.map((cat) => (
            <DropdownMenuItem key={cat} onClick={() => onCategorize(cat)} className="cursor-pointer">
              <span className="inline-block h-2 w-2 rounded-full mr-3" style={{ backgroundColor: categoryToColor(cat) }} />
              <span>Set as {cat}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function categoryToColor(cat: string): string {
  try {
    const { CATEGORIES } = require("@/lib/categories")
    return (CATEGORIES as any)[cat]?.color || (CATEGORIES as any)["Uncategorized"].color
  } catch {
    return "#6b7280"
  }
}

export function TransactionsTable() {
  const pageSize = 12
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [showFilters, setShowFilters] = useState(false)
  const offset = pagination.pageIndex * pagination.pageSize

  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, getCurrencySymbol } = useCurrency()
  const updateTx = useUpdateTransaction()
  const autoCategorize = useAutoCategorize()

  const apiDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    }
    return undefined
  }, [dateRange, formatDateForAPI])

  const { data, isLoading, error } = useTransactions({ limit: pageSize, offset, dateRange: apiDateRange })

  const rows: TxRow[] = (data?.transactions || []).map((t: any) => ({
    id: t.$id || t.id,
    description: t.description || t.counterparty || "Unknown",
    category: t.category || "Uncategorized",
    bankName: t.institutionId || "Unknown",
    bookingDate: t.bookingDate || t.date,
    amount: Number(t.amount) || 0,
    currency: t.currency || "EUR",
    accountId: t.accountId,
    exclude: Boolean(t.exclude),
  }))

  const totalCount = data?.total || rows.length

  const bankOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.bankName).filter(Boolean))).sort(), [rows])

  function handleToggleExclude(tx: TxRow) {
    updateTx.mutate({ id: tx.id, exclude: !tx.exclude })
  }

  function handleCategorize(tx: TxRow, category: string) {
    updateTx.mutate({ id: tx.id, category })
  }

  const activeFilterCount = columnFilters.length

  const clearAllFilters = () => {
    setColumnFilters([])
  }

  const columns: ColumnDef<TxRow>[] = useMemo(
    () => [
      {
        accessorKey: "bookingDate",
        header: "Date",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {(() => {
                const d = new Date(row.original.bookingDate)
                const day = d.getDate().toString().padStart(2, "0")
                const month = d.toLocaleString("en-GB", { month: "short" })
                return `${day} ${month}`
              })()}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(row.original.bookingDate).getFullYear()}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Transaction",
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[300px]">
            <span className="font-medium text-sm truncate">
              {row.getValue("description")}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.bankName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "bankName",
        header: "Bank",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground">
            {row.getValue("bankName")}
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-muted/50 border border-border/50">
                <span 
                  className="inline-block h-2 w-2 rounded-full mr-2" 
                  style={{ backgroundColor: categoryToColor(String(row.getValue("category"))) }} 
                />
                <span className="text-xs font-medium">{row.getValue("category")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {CATEGORY_OPTIONS.map((cat) => (
                <DropdownMenuItem key={cat} onClick={() => handleCategorize(row.original, cat)} className="cursor-pointer">
                  <span className="inline-block h-2 w-2 rounded-full mr-3" style={{ backgroundColor: categoryToColor(cat) }} />
                  <span className="text-xs">{cat}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
      {
        accessorKey: "exclude",
        header: () => <div className="text-center">Exclude</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={Boolean(row.original.exclude)}
              onCheckedChange={() => handleToggleExclude(row.original)}
              aria-label="Exclude transaction"
              className="h-4 w-4"
            />
          </div>
        ),
        enableSorting: false,
        size: 80,
        filterFn: (row, _columnId, value: string) => {
          if (!value || value === "all") return true
          const isExcluded = Boolean(row.original.exclude)
          return value === "true" ? isExcluded : !isExcluded
        },
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
          const original = Number(row.getValue("amount"))
          const converted = convertAmount(original, row.original.currency, baseCurrency)
          const isIncome = converted > 0
          const formatted = `${isIncome ? "+" : ""}${getCurrencySymbol(baseCurrency)}${converted.toFixed(2)}`
          return (
            <div className="text-right">
              <span className={`font-medium ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatted}
              </span>
            </div>
          )
        },
        filterFn: (row, columnId, value: { min?: number; max?: number }) => {
          const original = Number(row.getValue(columnId))
          const converted = convertAmount(original, row.original.currency, baseCurrency)
          const absAmount = Math.abs(converted) // Compare absolute values for filtering
          
          if (typeof value?.min === "number" && !Number.isNaN(value.min) && absAmount < value.min) return false
          if (typeof value?.max === "number" && !Number.isNaN(value.max) && absAmount > value.max) return false
          return true
        },
      }
    ],
    [baseCurrency, convertAmount, getCurrencySymbol]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: { pagination, columnFilters, columnVisibility },
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  })

  if (isLoading) {
    return (
      <div className="border rounded-xl overflow-hidden">
        <div className="h-64 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Loading transactions...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-xl overflow-hidden">
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-destructive mb-2">⚠️ Failed to load transactions</div>
            <div className="text-sm text-muted-foreground">Please try refreshing the page</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
      {/* Header with Search and Filter Toggle */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("description")?.setFilterValue(e.target.value)}
              className="h-9 w-64 pl-9 bg-background/50 border-border/50 focus:bg-background"
            />
          </div>
          
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9 gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => autoCategorize.mutate(undefined)}
            disabled={autoCategorize.isPending}
          >
            <Sparkles className="h-4 w-4" />
            {autoCategorize.isPending ? "Categorizing..." : "Auto-categorize"}
          </Button>

          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Zap className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize cursor-pointer"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expandable Filters */}
      {showFilters && (
        <div className="p-4 bg-muted/20 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              value={(table.getColumn("bankName")?.getFilterValue() as string) ?? "all"}
              onValueChange={(val) => table.getColumn("bankName")?.setFilterValue(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 bg-background/50">
                <SelectValue placeholder="All banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All banks</SelectItem>
                {bankOptions.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("category")?.getFilterValue() as string) ?? "all"}
              onValueChange={(val) => table.getColumn("category")?.setFilterValue(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 bg-background/50">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: categoryToColor(cat) }} />
                      {cat}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("exclude")?.getFilterValue() as string) ?? "all"}
              onValueChange={(val) => table.getColumn("exclude")?.setFilterValue(val)}
            >
              <SelectTrigger className="h-9 bg-background/50">
                <SelectValue placeholder="Show all" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All transactions</SelectItem>
                <SelectItem value="false">Included only</SelectItem>
                <SelectItem value="true">Excluded only</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder="Min"
                className="h-9 bg-background/50"
                value={(() => {
                  const v = table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number } | undefined
                  return v?.min !== undefined ? v.min.toString() : ""
                })()}
                onChange={(e) => {
                  const current = (table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number }) || {}
                  const val = e.target.value
                  const min = val === "" ? undefined : parseFloat(val)
                  if (val === "" || (!isNaN(min!) && min! >= 0)) {
                    table.getColumn("amount")?.setFilterValue({ ...current, min })
                  }
                }}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Max"
                className="h-9 bg-background/50"
                value={(() => {
                  const v = table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number } | undefined
                  return v?.max !== undefined ? v.max.toString() : ""
                })()}
                onChange={(e) => {
                  const current = (table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number }) || {}
                  const val = e.target.value
                  const max = val === "" ? undefined : parseFloat(val)
                  if (val === "" || (!isNaN(max!) && max! >= 0)) {
                    table.getColumn("amount")?.setFilterValue({ ...current, max })
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-muted-foreground h-12 first:pl-6 bg-muted/10">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow 
                key={row.id} 
                className="hover:bg-muted/30 transition-colors border-border/30"
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="first:pl-6 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <div className="mb-2">📊</div>
                  <div className="font-medium">No transactions found</div>
                  <div className="text-sm">Try adjusting your filters</div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/10 to-muted/5 border-t">
        <div className="text-sm text-muted-foreground">
          Showing {offset + 1} to {Math.min(offset + pageSize, totalCount)} of {totalCount} transactions
        </div>
        
        <div className="flex items-center gap-6">
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
    </div>
  )
}