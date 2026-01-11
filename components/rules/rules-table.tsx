"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Power,
  PowerOff,
  FileText,
  Calendar,
  Check,
  X,
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
          toast.success("Rule deleted successfully")
        },
        onError: (error) => {
          toast.error(`Failed to delete rule: ${error.message}`)
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
          toast.success(`Rule applied to ${result.totalModified} transaction(s)`)
          refetch()
        },
        onError: (error) => {
          setApplyingRule(undefined)
          toast.error(`Failed to apply rule: ${error.message}`)
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
          toast.success(`Applied all rules to ${result.totalModified} transaction(s)`)
          refetch()
        },
        onError: (error) => {
          toast.error(`Failed to apply rules: ${error.message}`)
        },
      }
    )
  }

  function formatConditionSummary(rule: TransactionRule) {
    if (rule.conditions.length === 0) return "No conditions"

    return rule.conditions
      .map((condition) => {
        const field = condition.field.replace(/([A-Z])/g, " $1").toLowerCase()
        const operator = condition.operator.replace(/([A-Z])/g, " $1").toLowerCase()
        return `${field} ${operator} "${condition.value}"`
      })
      .join(` ${rule.conditionLogic || "AND"} `)
  }

  function formatActionSummary(rule: TransactionRule) {
    if (rule.actions.length === 0) return "No actions"

    return rule.actions
      .map((action) => {
        const actionType = action.type.replace(/([A-Z])/g, " $1").toLowerCase()
        return `${actionType} "${action.value}"`
      })
      .join(", ")
  }

  function getRulePriorityVariant(priority: number): "default" | "secondary" | "destructive" | "outline" {
    if (priority >= 80) return "destructive"
    if (priority >= 60) return "default"
    if (priority >= 40) return "secondary"
    return "outline"
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <div className="text-destructive mb-2">⚠️</div>
          <p className="font-semibold mb-2">Unable to Load Rules</p>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "There was a problem loading your rules. Please try again."}
          </p>
          <Button variant="outline" onClick={() => refetch()} size="sm">
            Try Again
          </Button>
        </div>
      </Card>
    )
  }

  if (!rules || rules.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-muted">
            <Settings className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No rules yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first rule to automatically categorize transactions based on conditions you define.
          </p>
          {onCreateRule && (
            <Button onClick={onCreateRule}>
              <Settings className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const enabledRulesCount = rules.filter((r) => r.enabled).length

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium">Transaction Rules</h3>
          <p className="text-sm text-muted-foreground">
            {enabledRulesCount} of {rules.length} rules enabled
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowApplyAllDialog(true)} disabled={enabledRulesCount === 0}>
            <Play className="h-4 w-4 mr-2" />
            Apply All
          </Button>
          {onCreateRule && (
            <Button onClick={onCreateRule}>
              <Settings className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {rules
          .sort((a, b) => b.priority - a.priority)
          .map((rule) => (
            <Card
              key={`rule-${rule.id}-${rule.updatedAt}`}
              className={`${!rule.enabled ? "opacity-60" : ""}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge variant={getRulePriorityVariant(rule.priority)} className="text-xs">
                        {rule.priority}
                      </Badge>
                      {rule.enabled ? (
                        <Badge variant="default" className="text-xs">
                          <Power className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <PowerOff className="h-3 w-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRuleEnabled(rule)}
                      disabled={updateRule.isPending}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
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
                          Apply Rule
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteRule(rule)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground">Conditions: </span>
                      <span className="text-foreground">{formatConditionSummary(rule)}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground">Actions: </span>
                      <span className="text-foreground">{formatActionSummary(rule)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created {new Date(rule.createdAt).toLocaleDateString()}
                    </div>
                    {rule.matchCount > 0 && (
                      <div>Applied {rule.matchCount} time{rule.matchCount !== 1 ? "s" : ""}</div>
                    )}
                    {rule.lastMatched && (
                      <div>Last matched {new Date(rule.lastMatched).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRule} onOpenChange={(open: boolean) => !open && setDeletingRule(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule "{deletingRule?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRule.isPending}
            >
              {deleteRule.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply All Rules Dialog */}
      <AlertDialog open={showApplyAllDialog} onOpenChange={setShowApplyAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply All Rules</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply all {enabledRulesCount} enabled rules to your existing transactions. Transactions will be
              updated in the database. This may take a few moments for large numbers of transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyAllRules.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApplyAllRules}
              disabled={applyAllRules.isPending}
            >
              {applyAllRules.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Apply All Rules
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
