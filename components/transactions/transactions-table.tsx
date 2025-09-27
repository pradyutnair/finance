"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, MoreVertical, ChevronsLeft, ChevronsRight } from "lucide-react"
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
          <Button size="icon" variant="ghost" className="rounded-full p-2" aria-label="Row actions">
            <MoreVertical className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {CATEGORY_OPTIONS.map((cat) => (
            <DropdownMenuItem key={cat} onClick={() => onCategorize(cat)}>
              <span>Set category: {cat}</span>
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
  const offset = pagination.pageIndex * pagination.pageSize

  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, getCurrencySymbol } = useCurrency()
  const updateTx = useUpdateTransaction()

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
    // optimistic set via mutation; additionally adjust local row to reflect immediately
    updateTx.mutate({ id: tx.id, category })
  }

  const columns: ColumnDef<TxRow>[] = useMemo(
    () => [
      
      {
        accessorKey: "bookingDate",
        header: "Date",
        cell: ({ row }) => (
            <span className="whitespace-nowrap">
            {(() => {
              const d = new Date(row.original.bookingDate)
              const day = d.getDate().toString().padStart(2, "0")   // dd
              const month = d.toLocaleString("en-GB", { month: "short" }) // MMM
              const year = d.getFullYear()                          // yyyy
              return `${day} ${month} ${year}`
            })()}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: "Transaction",
        cell: ({ row }) => (
          <div className="flex items-center text-sm">
            <span className="text-card-foreground font-medium truncate max-w-[360px]">
              {row.getValue("description")}
            </span>
          </div>
        ),
      },
      {
        accessorFn: (row) => row.description,
        id: "details",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm truncate max-w-[360px]">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "bankName",
        header: "Bank",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.bankName}</span>
        ),
        enableSorting: false,
        size: 120,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2 py-1 capitalize">
                <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: categoryToColor(String(row.getValue("category"))) }} />
                {row.getValue("category")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {CATEGORY_OPTIONS.map((cat) => (
                <DropdownMenuItem key={cat} onClick={() => handleCategorize(row.original, cat)}>
                  <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: categoryToColor(cat) }} />
                  {cat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
      {
        accessorKey: "exclude",
        header: "Exclude",
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={Boolean(row.original.exclude)}
              onCheckedChange={() => handleToggleExclude(row.original)}
              aria-label="Exclude transaction"
            />
          </div>
        ),
        enableSorting: false,
        size: 60,
        filterFn: (row, _columnId, value: string) => {
          if (!value || value === "all") return true
          const isExcluded = Boolean(row.original.exclude)
          return value === "true" ? isExcluded : !isExcluded
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const original = Number(row.getValue("amount"))
          const converted = convertAmount(original, row.original.currency, baseCurrency)
          const isIncome = converted > 0
          const formatted = `${isIncome ? "+" : "-"}${getCurrencySymbol(baseCurrency)}${Math.abs(converted).toFixed(2)}`
          return (
            <span className={isIncome ? "text-green-600 dark:text-green-400" : "text-destructive"}>{formatted}</span>
          )
        },
        filterFn: (row, columnId, value: { min?: number; max?: number }) => {
          const original = Number(row.getValue(columnId))
          const converted = convertAmount(original, row.original.currency, baseCurrency)
          if (typeof value?.min === "number" && !Number.isNaN(value.min) && converted < value.min) return false
          if (typeof value?.max === "number" && !Number.isNaN(value.max) && converted > value.max) return false
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
    return <div className="h-24 text-sm text-muted-foreground flex items-center">Loading...</div>
  }

  if (error) {
    return <div className="h-24 text-sm text-muted-foreground flex items-center">Failed to load transactions</div>
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Input
          placeholder="Filter transaction..."
          value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("description")?.setFilterValue(e.target.value)}
          className="h-9 w-48"
        />

        <Select
          value={(table.getColumn("bankName")?.getFilterValue() as string) ?? "all"}
          onValueChange={(val) => table.getColumn("bankName")?.setFilterValue(val === "all" ? "" : val)}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Bank" />
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
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={(table.getColumn("exclude")?.getFilterValue() as string) ?? "all"}
          onValueChange={(val) => table.getColumn("exclude")?.setFilterValue(val)}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Excluded" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="false">Included only</SelectItem>
            <SelectItem value="true">Excluded only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Min amount"
            className="h-9 w-36"
            value={(() => {
              const v = table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number } | undefined
              return v?.min ?? ""
            })()}
            onChange={(e) => {
              const current = (table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number }) || {}
              const val = e.target.value
              const min = val === "" ? undefined : Number(val)
              table.getColumn("amount")?.setFilterValue({ ...current, min })
            }}
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Max amount"
            className="h-9 w-36"
            value={(() => {
              const v = table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number } | undefined
              return v?.max ?? ""
            })()}
            onChange={(e) => {
              const current = (table.getColumn("amount")?.getFilterValue() as { min?: number; max?: number }) || {}
              const val = e.target.value
              const max = val === "" ? undefined : Number(val)
              table.getColumn("amount")?.setFilterValue({ ...current, max })
            }}
          />
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-muted-foreground h-12 first:pl-4">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="first:pl-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          Showing {offset + 1} to {Math.min(offset + pageSize, totalCount)} of {totalCount}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


