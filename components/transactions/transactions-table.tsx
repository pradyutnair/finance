"use client"

import { useMemo, useState, useEffect } from "react"
import { Edit2, Check, Plus, Settings } from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useTransactions, useAccounts } from "@/lib/api"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"
import { useUpdateTransaction } from "@/lib/api"
import { useAutoCategorize } from "@/lib/api"
import { useTransactionRules } from "@/lib/api/transaction-rules"
import { CATEGORY_OPTIONS } from "@/lib/categories"
import { formatBankName } from "@/lib/bank-name-mapping"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { applyBestMatchingRule } from "@/lib/rule-engine"
import type { TransactionRule } from "@/lib/types/transaction-rules"
type TxRow = {
  id: string
  description: string
  rawDescription?: string
  bankName: string
  category: string
  bookingDate: string
  amount: number
  currency: string
  accountId?: string
  exclude?: boolean
  counterparty?: string
}

function RowActions({
  onCategorize,
  onCreateRule,
  onCreateRuleFromTransaction
}: {
  onCategorize: (category: string) => void
  onCreateRule: () => void
  onCreateRuleFromTransaction: (transaction: TxRow) => void
}) {
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
          <DropdownMenuItem onClick={onCreateRule} className="cursor-pointer">
            <Settings className="h-4 w-4 mr-3" />
            <span>Create Rule</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreateRuleFromTransaction} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-3" />
            <span>Create Rule from This Transaction</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
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
  const pageSize = 10
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    description: false,
    accountId: false
  })
  const [showFilters, setShowFilters] = useState(false)
  const [editingCounterparty, setEditingCounterparty] = useState<{ id: string; value: string } | null>(null)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [transactionForRule, setTransactionForRule] = useState<TxRow | null>(null)
  const [categorizeDialog, setCategorizeDialog] = useState<{
    open: boolean
    transaction: TxRow | null
    category: string | null
    similarTransactionIds: string[]
  }>({ open: false, transaction: null, category: null, similarTransactionIds: [] })
  const offset = pagination.pageIndex * pagination.pageSize

  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, getCurrencySymbol, formatAmount } = useCurrency()
  const updateTx = useUpdateTransaction()
  const autoCategorize = useAutoCategorize()
  const { data: accounts } = useAccounts()
  const { data: rules } = useTransactionRules()

  const apiDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    }
    return undefined
  }, [dateRange, formatDateForAPI])

  const hasActiveFilters = useMemo(() => {
    return columnFilters.some((f: any) => {
      const val = f?.value
      if (val == null) return false
      if (typeof val === "string")
      return val.trim() !== "" && val !== "all"
      if (typeof val === "object") return (val.min != null && !Number.isNaN(val.min)) || (val.max != null && !Number.isNaN(val.max))
      return true
    })
  }, [columnFilters])

  // Fetch ALL transactions once - this will be used for both display and similarity matching
  // This eliminates the need for backend pagination calls
  const { data: allTransactionsData, isLoading, error } = useTransactions({
    all: true,
    includeExcluded: true
    // Note: No dateRange filter - we want ALL transactions for accurate similarity matching
  })

  const accountIdToInstitutionId = useMemo(() => {
    const map = new Map<string, string>()
    ;(accounts || []).forEach((acc: any) => {
      const acctId = acc?.accountId || acc?.$id
      const instId = acc?.institutionId || acc?.connectionInstitutionId
      if (acctId && instId) map.set(acctId, instId)
    })
    return map
  }, [accounts])

  // All transactions for similarity matching and display (decrypted on client)
  const allTransactions: TxRow[] = useMemo(() =>
    (allTransactionsData?.transactions || []).map((t: any) => ({
      id: t.id || t.$id,
      description: t.description || t.counterparty || "Unknown",
      rawDescription: t.description,
      category: t.category || "Uncategorized",
      bankName: accountIdToInstitutionId.get(t.accountId) || "Unknown",
      bookingDate: t.bookingDate || t.date,
      amount: Number(t.amount) || 0,
      currency: t.currency || "EUR",
      accountId: t.accountId,
      exclude: Boolean(t.exclude),
      counterparty: t.counterparty,
    })), [allTransactionsData, accountIdToInstitutionId]
  )

  // Filter transactions by date range and apply rules
  const dateFilteredTransactions = useMemo(() => {
    if (!allTransactions.length) return []

    let filteredTransactions = allTransactions.filter(tx => {
      // Apply date range filter
      if (apiDateRange?.from && tx.bookingDate < apiDateRange.from) return false
      if (apiDateRange?.to && tx.bookingDate > apiDateRange.to) return false
      return true
    })

    // Apply user rules to transactions if available
    if (rules && rules.length > 0) {
      const enabledRules = rules.filter(rule => rule.enabled)
      if (enabledRules.length > 0) {
        filteredTransactions = filteredTransactions.map(tx => {
          const result = applyBestMatchingRule(tx, enabledRules)
          return result.transaction
        })
      }
    }

    return filteredTransactions
  }, [allTransactions, apiDateRange, rules])

  const totalCount = dateFilteredTransactions.length

  const bankOptions = useMemo(() => Array.from(new Set(dateFilteredTransactions.map((r) => r.bankName).filter(Boolean))).sort(), [dateFilteredTransactions])

  function handleToggleExclude(tx: TxRow) {
    updateTx.mutate({ id: tx.id, exclude: !tx.exclude })
  }

  function handleCategorize(tx: TxRow, category: string) {
    // Find similar transactions on client-side (where data is decrypted)
    const normalize = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "")
    const targetDesc = normalize(tx.rawDescription)
    const targetCp = normalize(tx.counterparty)

    // Find all transactions with matching description or counterparty across ALL transactions
    const similarTransactionIds: string[] = []
    if (targetDesc || targetCp) {
      allTransactions.forEach((row) => {
        if (row.id === tx.id) return // Skip the target transaction itself
        const rowDesc = normalize(row.rawDescription)
        const rowCp = normalize(row.counterparty)
        const matches = (targetDesc && rowDesc === targetDesc) || (targetCp && rowCp === targetCp)
        if (matches) {
          similarTransactionIds.push(row.id)
        }
      })
    }

    console.log(`[Category Update] Found ${similarTransactionIds.length} similar transactions across all time`)
    console.log(`[Category Update] Total transactions to update: ${similarTransactionIds.length + 1}`)

    // Show confirmation dialog if there are similar transactions
    if (similarTransactionIds.length > 0) {
      setCategorizeDialog({
        open: true,
        transaction: tx,
        category,
        similarTransactionIds
      })
    } else {
      // No similar transactions, update directly
      updateTx.mutate({
        id: tx.id,
        category,
        description: tx.rawDescription,
        counterparty: tx.counterparty,
        similarTransactionIds: []
      })
    }
  }

  function handleStartEditCounterparty(tx: TxRow) {
    setEditingCounterparty({ id: tx.id, value: tx.counterparty || "" })
  }

  function handleSaveCounterparty() {
    if (editingCounterparty) {
      updateTx.mutate({
        id: editingCounterparty.id,
        counterparty: editingCounterparty.value.trim() || undefined
      })
      setEditingCounterparty(null)
    }
  }

  function handleCancelEditCounterparty() {
    setEditingCounterparty(null)
  }

  function handleCounterpartyChange(value: string) {
    if (editingCounterparty) {
      setEditingCounterparty({ ...editingCounterparty, value })
    }
  }

  function handleCategorizeOnlyThis() {
    if (categorizeDialog.transaction && categorizeDialog.category) {
      updateTx.mutate({
        id: categorizeDialog.transaction.id,
        category: categorizeDialog.category,
        description: categorizeDialog.transaction.rawDescription,
        counterparty: categorizeDialog.transaction.counterparty,
        similarTransactionIds: []
      })
      setCategorizeDialog({ open: false, transaction: null, category: null, similarTransactionIds: [] })
    }
  }

  function handleCategorizeAllMatching() {
    if (categorizeDialog.transaction && categorizeDialog.category) {
      updateTx.mutate({
        id: categorizeDialog.transaction.id,
        category: categorizeDialog.category,
        description: categorizeDialog.transaction.rawDescription,
        counterparty: categorizeDialog.transaction.counterparty,
        similarTransactionIds: categorizeDialog.similarTransactionIds
      })
      setCategorizeDialog({ open: false, transaction: null, category: null, similarTransactionIds: [] })
    }
  }

  function handleCancelCategorize() {
    setCategorizeDialog({ open: false, transaction: null, category: null, similarTransactionIds: [] })
  }

  function handleCreateRule() {
    setTransactionForRule(null)
    setRuleDialogOpen(true)
  }

  function handleCreateRuleFromTransaction(transaction: TxRow) {
    setTransactionForRule(transaction)
    setRuleDialogOpen(true)
  }

  const activeFilterCount = columnFilters.length

  const clearAllFilters = () => {
    setColumnFilters([])
  }

  // Reset to first page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [columnFilters])

  // Cancel editing when mutation succeeds
  useEffect(() => {
    if (updateTx.isSuccess && editingCounterparty) {
      setEditingCounterparty(null)
    }
  }, [updateTx.isSuccess, editingCounterparty])

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
        accessorKey: "counterparty",
        header: "Payee",
        cell: ({ row }) => {
          const isEditing = editingCounterparty?.id === row.original.id
          const currentValue = isEditing ? editingCounterparty.value : String(row.getValue("counterparty") || "")

          if (isEditing) {
            return (
              <div className="flex items-center gap-2 min-w-[200px] edit-counterparty">
                <Input
                  value={currentValue}
                  onChange={(e) => handleCounterpartyChange(e.target.value)}
                  className="h-7 text-sm flex-1"
                  placeholder="Enter payee..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveCounterparty()
                    } else if (e.key === "Escape") {
                      handleCancelEditCounterparty()
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-1 edit-counterparty">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveCounterparty}
                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEditCounterparty}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <div className="flex items-center gap-2 group max-w-[300px]">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-sm truncate">
                  {currentValue || String(row.original.description || "") || "Unknown"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.original.description &&
                  !/^[^\d]{0,2}\d/.test(row.original.description) &&
                  (row.original.description.length > 25
                    ? row.original.description.slice(0, 25) + "..."
                    : row.original.description)}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleStartEditCounterparty(row.original)}
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )
        },
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-center min-w-[80px] sm:min-w-[100px]">Amount</div>,
        cell: ({ row }) => {
          const original = Number(row.getValue("amount"))
          const converted = convertAmount(original, row.original.currency, baseCurrency)
          const isIncome = converted > 0
          const formatted = `${isIncome ? "+" : ""}${getCurrencySymbol(baseCurrency)}${converted.toFixed(2)}`
          return (
            <div className="text-center px-2 sm:px-4 min-w-[80px] sm:min-w-[100px]">
              <span className={`font-medium text-sm ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
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
      },
      {
        accessorKey: "bankName",
        header: () => <div className="pl-6">Bank</div>,
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground pl-6">
            {formatBankName(String(row.getValue("bankName") || ""))}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: () => <div className="hidden sm:block">Description</div>,
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
            {row.getValue("description")}
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-muted/50 border border-border/50 text-xs sm:text-sm">
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
        accessorKey: "accountId",
        header: "Account",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground">
            {row.getValue("accountId")}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        cell: ({ row }) => (
          <RowActions
            onCategorize={(category) => handleCategorize(row.original, category)}
            onCreateRule={handleCreateRule}
            onCreateRuleFromTransaction={() => handleCreateRuleFromTransaction(row.original)}
          />
        ),
        enableSorting: false,
        size: 50,
      }
    ],
    [baseCurrency, convertAmount, getCurrencySymbol, editingCounterparty, handleStartEditCounterparty, handleSaveCounterparty, handleCancelEditCounterparty, handleCounterpartyChange, handleCreateRule, handleCreateRuleFromTransaction]
  )

  const table = useReactTable({
    data: dateFilteredTransactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: { pagination, columnFilters, columnVisibility },
    manualPagination: false, // Use client-side pagination now
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  })

  const visibleTransactions = useMemo(() => {
    return table.getFilteredRowModel().rows.map(row => row.original)
  }, [table])

  const { totalIncome, totalExpenses, netTotal } = useMemo(() => {
    const income = visibleTransactions
      .filter(tx => {
        const converted = convertAmount(tx.amount, tx.currency, baseCurrency)
        return converted > 0
      })
      .reduce((sum, tx) => {
        const converted = convertAmount(tx.amount, tx.currency, baseCurrency)
        return sum + converted
      }, 0)

    const expenses = visibleTransactions
      .filter(tx => {
        const converted = convertAmount(tx.amount, tx.currency, baseCurrency)
        return converted < 0
      })
      .reduce((sum, tx) => {
        const converted = convertAmount(tx.amount, tx.currency, baseCurrency)
        return sum + Math.abs(converted)
      }, 0)

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netTotal: income - expenses
    }
  }, [visibleTransactions, convertAmount, baseCurrency])

  // Always use proper pagination - don't show all results at once even when filtered
  const rowsToRender = table.getRowModel().rows

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
    <>
      <div
        className="border rounded-xl overflow-hidden shadow-sm bg-card min-h-0 flex flex-col h-full"
        onClick={(e) => {
          // Cancel editing if clicking outside edit input
          if (editingCounterparty && !(e.target as HTMLElement).closest('.edit-counterparty')) {
            setEditingCounterparty(null)
          }
        }}
      >
      {/* Header with Search and Filter Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 sm:flex-initial max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search payees..."
              value={(table.getColumn("counterparty")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("counterparty")?.setFilterValue(e.target.value)}
              className="h-9 w-full pl-9 bg-background/50 border-border/50 focus:bg-background"
            />
          </div>
          
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9 gap-2 flex-shrink-0"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 gap-2 flex-shrink-0">
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 flex-shrink-0"
            onClick={handleCreateRule}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Rule</span>
          </Button> */}

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 flex-shrink-0"
            onClick={() => autoCategorize.mutate(undefined)}
            disabled={autoCategorize.isPending}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">
              {autoCategorize.isPending ? "Categorizing..." : "Auto-categorize"}
            </span>
          </Button>

          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 flex-shrink-0">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Columns</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  <SelectItem key={b} value={b}>{formatBankName(b)}</SelectItem>
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
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="w-full">
              <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50 sticky top-0 bg-background z-10">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-muted-foreground h-12 first:pl-6 bg-muted/10">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rowsToRender?.length ? (
                  <>
                    {rowsToRender.map((row) => (
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
                    ))}
                    {/* Add empty rows to fill remaining space and maintain consistent height */}
                    {Array.from({ length: Math.max(0, pageSize - rowsToRender.length) }).map((_, index) => (
                      <TableRow key={`empty-${index}`} className="hover:bg-transparent">
                        {columns.map((_, colIndex) => (
                          <TableCell key={colIndex} className="first:pl-6 py-3 h-[60px] border-b border-border/20">
                            <div className="h-[60px]" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center">
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <div className="mb-2">📊</div>
                        <div className="font-medium">No transactions found</div>
                        <div className="text-sm">Try adjusting your filters</div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gradient-to-r from-muted/10 to-muted/5 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1} to {Math.min(offset + pageSize, totalCount)} of {totalCount} transactions
          </div>
          {(totalIncome > 0 || totalExpenses > 0) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
              {totalIncome > 0 && (
                <div className="font-medium">
                  <span className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                    Income: +{formatAmount(totalIncome)}
                  </span>
                </div>
              )}
              {totalExpenses > 0 && (
                <div className="font-medium">
                  <span className="text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                    Expenses: -{formatAmount(totalExpenses)}
                  </span>
                </div>
              )}
            </div>
          )}
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

      {/* Category Confirmation Dialog */}
      <Dialog open={categorizeDialog.open} onOpenChange={(open) => !open && handleCancelCategorize()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Transaction Category</DialogTitle>
            <DialogDescription>
              Found {categorizeDialog.similarTransactionIds.length} similar transaction{categorizeDialog.similarTransactionIds.length !== 1 ? 's' : ''} with the same payee or description.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 py-4">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: categoryToColor(categorizeDialog.category || '') }}
            />
            <span className="font-medium">{categorizeDialog.category}</span>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelCategorize}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleCategorizeOnlyThis}
              className="flex-1"
            >
              Only This Transaction
            </Button>
            <Button
              variant="default"
              onClick={handleCategorizeAllMatching}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              All ({categorizeDialog.similarTransactionIds.length + 1})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <RuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={transactionForRule ? {
          id: "",
          userId: "",
          name: `Rule for ${transactionForRule.counterparty || transactionForRule.description}`,
          description: "Auto-generated from transaction",
          enabled: true,
          priority: 50,
          conditions: [
            {
              field: "counterparty",
              operator: "contains",
              value: transactionForRule.counterparty || transactionForRule.description,
              caseSensitive: false
            }
          ],
          conditionLogic: "AND",
          actions: [
            {
              type: "setCategory",
              value: transactionForRule.category
            }
          ],
          matchCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        } : undefined}
        onSuccess={() => {
          setRuleDialogOpen(false)
          setTransactionForRule(null)
        }}
      />

    </div>
  </>
  )
}