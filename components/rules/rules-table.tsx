"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { useTransactionRules, useUpdateTransactionRule, useDeleteTransactionRule, useApplyTransactionRule, useApplyAllTransactionRules } from "@/lib/api/transaction-rules"
import { RuleDialogV2 } from "./rule-dialog-v2"
import { toast } from "sonner"
import type { TransactionRule } from "@/lib/types/transaction-rules"

interface RulesTableProps {
  onCreateRule?: () => void
  onEditRule?: (rule: TransactionRule) => void
}

export function RulesTable({ onCreateRule, onEditRule }: RulesTableProps) {
  const [editingRule, setEditingRule] = useState<TransactionRule | undefined>()
  const [deletingRule, setDeletingRule] = useState<TransactionRule | undefined>()
  const [applyingRule, setApplyingRule] = useState<TransactionRule | undefined>()
  const [showApplyAllDialog, setShowApplyAllDialog] = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  const { data: rules, isLoading, error, refetch } = useTransactionRules()
  const updateRule = useUpdateTransactionRule()
  const deleteRule = useDeleteTransactionRule()
  const applyRule = useApplyTransactionRule()
  const applyAllRules = useApplyAllTransactionRules()

  function handleToggleRuleEnabled(rule: TransactionRule) {
    updateRule.mutate(
      { id: rule.id, enabled: !rule.enabled },
      {
        onSuccess: () => {
          toast.success(rule.enabled ? "Rule disabled" : "Rule enabled")
        },
        onError: (error) => {
          toast.error(`Failed to toggle rule: ${error.message}`)
        },
      }
    )
  }

  function handleEditRule(rule: TransactionRule) {
    setEditingRule(rule)
    onEditRule?.(rule)
  }

  function handleDeleteRule(rule: TransactionRule) {
    setDeletingRule(rule)
  }

  function confirmDeleteRule() {
    if (deletingRule) {
      deleteRule.mutate(deletingRule.id, {
        onSuccess: () => {
          setDeletingRule(undefined)
          toast.success("Rule deleted")
        },
        onError: (error) => {
          toast.error(`Failed to delete: ${error.message}`)
        },
      })
    }
  }

  function handleApplyRule(rule: TransactionRule) {
    setApplyingRule(rule)
    applyRule.mutate(
      {
        ruleId: rule.id,
        options: {
          applyToExisting: true,
          dryRun: false,
        },
      },
      {
        onSuccess: (result) => {
          setApplyingRule(undefined)
          toast.success(`Applied to ${result.totalModified} transaction${result.totalModified !== 1 ? "s" : ""}`)
          refetch()
        },
        onError: (error) => {
          setApplyingRule(undefined)
          toast.error(`Failed: ${error.message}`)
        },
      }
    )
  }

  function handleApplyAllRules() {
    applyAllRules.mutate(
      {},
      {
        onSuccess: (result) => {
          setShowApplyAllDialog(false)
          toast.success(`Applied to ${result.totalModified} transaction${result.totalModified !== 1 ? "s" : ""}`)
          refetch()
        },
        onError: (error) => {
          toast.error(`Failed: ${error.message}`)
        },
      }
    )
  }

  function formatCondition(rule: TransactionRule) {
    if (rule.conditions.length === 0) return "No conditions"
    const c = rule.conditions[0]
    const field = c.field === "counterparty" ? "Payee" : c.field === "description" ? "Description" : c.field
    const op = c.operator === "contains" ? "contains" : c.operator === "equals" ? "is" : c.operator
    return `${field} ${op} "${c.value}"${rule.conditions.length > 1 ? ` +${rule.conditions.length - 1} more` : ""}`
  }

  function formatAction(rule: TransactionRule) {
    if (rule.actions.length === 0) return "No actions"
    const a = rule.actions[0]
    if (a.type === "setCategory") return `Category: ${a.value}`
    if (a.type === "setExclude") return `Exclude: ${a.value}`
    if (a.type === "setDescription") return `Set description`
    if (a.type === "setCounterparty") return `Set payee: ${a.value}`
    return `${a.type}`
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="p-4">
            <Skeleton className="h-5 w-40 mb-3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <p className="font-medium mb-1">Unable to load rules</p>
          <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : "Please try again"}</p>
          <Button variant="outline" onClick={() => refetch()} size="sm">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!rules || rules.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-[#40221a]/10">
            <Sparkles className="h-5 w-5 text-[#40221a]" />
          </div>
          <h3 className="font-medium mb-1">No rules yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create rules to auto-categorize transactions</p>
          {onCreateRule && (
            <Button onClick={onCreateRule} size="sm" className="bg-[#40221a] text-white">
              Create Rule
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const enabledCount = rules.filter((r) => r.enabled).length
  const isExpanded = (id: string) => expandedRule === id

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">{enabledCount} of {rules.length} enabled</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApplyAllDialog(true)}
            disabled={enabledCount === 0}
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Apply All
          </Button>
          {onCreateRule && (
            <Button size="sm" onClick={onCreateRule} className="bg-[#40221a] text-white hover:bg-[#40221a]/90">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              New Rule
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {rules
          .sort((a, b) => b.priority - a.priority)
          .map((rule) => (
            <Card
              key={`rule-${rule.id}-${rule.updatedAt}`}
              className={`${!rule.enabled ? "opacity-50" : ""}`}
            >
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedRule(isExpanded(rule.id) ? null : rule.id)}
                    className="shrink-0"
                  >
                    {isExpanded(rule.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{rule.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{formatCondition(rule)}</span>
                      <span>→</span>
                      <span>{formatAction(rule)}</span>
                    </div>
                    {isExpanded(rule.id) && rule.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{rule.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRuleEnabled(rule)}
                      disabled={updateRule.isPending}
                      className="data-[state=checked]:bg-[#40221a]"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleApplyRule(rule)}
                          disabled={!rule.enabled || applyRule.isPending}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Apply Now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteRule(rule)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {isExpanded(rule.id) && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Conditions</span>
                        <p className="mt-1">{rule.conditions.map(c =>
                          `${c.field} ${c.operator} "${c.value}"`
                        ).join(rule.conditionLogic === "OR" ? " OR " : " AND ")}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actions</span>
                        <p className="mt-1">{rule.actions.map(a =>
                          `${a.type}: ${a.value}`
                        ).join(", ")}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {rule.matchCount > 0 && `Applied ${rule.matchCount}x`}
                      {rule.matchCount > 0 && rule.lastMatched && " • "}
                      {rule.lastMatched && `Last: ${new Date(rule.lastMatched).toLocaleDateString()}`}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
      </div>

      {/* Edit Rule Dialog */}
      <RuleDialogV2
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(undefined)}
        rule={editingRule}
        onSuccess={() => {
          setEditingRule(undefined)
          refetch()
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRule} onOpenChange={(open: boolean) => !open && setDeletingRule(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingRule?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRule.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply All Confirmation */}
      <AlertDialog open={showApplyAllDialog} onOpenChange={setShowApplyAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply all rules?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply {enabledCount} enabled rule{enabledCount !== 1 ? "s" : ""} to all matching transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyAllRules.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyAllRules} disabled={applyAllRules.isPending}>
              {applyAllRules.isPending ? "Applying..." : "Apply"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
