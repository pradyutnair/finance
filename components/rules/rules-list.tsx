"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { EmptyState } from "@/components/ui/empty-state"
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Settings,
  Power,
  PowerOff,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar
} from "lucide-react"
import { useTransactionRules, useUpdateTransactionRule, useDeleteTransactionRule, useApplyTransactionRule } from "@/lib/api/transaction-rules"
import { RuleDialog } from "./rule-dialog"
import type { TransactionRule } from "@/lib/types/transaction-rules"

interface RulesListProps {
  onCreateRule?: () => void
  onEditRule?: (rule: TransactionRule) => void
}

export function RulesList({ onCreateRule, onEditRule }: RulesListProps) {
  const [editingRule, setEditingRule] = useState<TransactionRule | undefined>()
  const [deletingRule, setDeletingRule] = useState<TransactionRule | undefined>()
  const [applyingRule, setApplyingRule] = useState<TransactionRule | undefined>()
  const [showApplyAllDialog, setShowApplyAllDialog] = useState(false)

  const { data: rules, isLoading, error } = useTransactionRules()
  const updateRule = useUpdateTransactionRule()
  const deleteRule = useDeleteTransactionRule()
  const applyRule = useApplyTransactionRule()

  function handleToggleRuleEnabled(rule: TransactionRule) {
    updateRule.mutate({
      id: rule.id,
      enabled: !rule.enabled,
    })
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
        }
      },
      {
        onSuccess: (result) => {
          setApplyingRule(undefined)
          // You could show a success toast here
          console.log(`Rule applied successfully. Modified ${result.totalModified} transactions.`)
        },
      }
    )
  }

  function handleApplyAllRules() {
    // This would use the useApplyAllTransactionRules hook
    setShowApplyAllDialog(true)
  }

  function formatConditionSummary(rule: TransactionRule) {
    if (rule.conditions.length === 0) return "No conditions"

    return rule.conditions.map(condition => {
      const field = condition.field.replace(/([A-Z])/g, ' $1').toLowerCase()
      const operator = condition.operator.replace(/([A-Z])/g, ' $1').toLowerCase()
      return `${field} ${operator} "${condition.value}"`
    }).join(` ${rule.conditionLogic || "AND"} `)
  }

  function formatActionSummary(rule: TransactionRule) {
    if (rule.actions.length === 0) return "No actions"

    return rule.actions.map(action => {
      const actionType = action.type.replace(/([A-Z])/g, ' $1').toLowerCase()
      return `${actionType} "${action.value}"`
    }).join(", ")
  }

  function getRulePriorityVariant(priority: number) {
    if (priority >= 80) return "destructive"
    if (priority >= 60) return "secondary"
    if (priority >= 40) return "outline"
    return "outline"
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-8" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="font-semibold mb-2">Unable to Load Rules</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "There was a problem loading your rules. Please try again."}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()} size="sm">
                Refresh Page
              </Button>
              {onCreateRule && (
                <Button onClick={onCreateRule} size="sm">
                  Create Rule Anyway
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!rules || rules.length === 0) {
    return (
      <EmptyState
        icon={<Settings className="h-8 w-8" />}
        title="No rules yet"
        description="Create your first rule to automatically categorize transactions"
        action={
          onCreateRule && (
            <Button onClick={onCreateRule}>
              <Settings className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          )
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Transaction Rules</h3>
          <p className="text-sm text-muted-foreground">
            {rules.filter(r => r.enabled).length} of {rules.length} rules enabled
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleApplyAllRules}>
            <Play className="h-4 w-4 mr-2" />
            Apply All Rules
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
            <Card key={`rule-${rule.id}-${rule.updatedAt}`} className={`${!rule.enabled ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <Badge variant={getRulePriorityVariant(rule.priority)}>
                        Priority {rule.priority}
                      </Badge>
                      {rule.enabled ? (
                        <Badge variant="default">
                          <Power className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
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
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Conditions:
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      {formatConditionSummary(rule)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Settings className="h-4 w-4" />
                      Actions:
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      {formatActionSummary(rule)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Created {new Date(rule.createdAt).toLocaleDateString()}
                    </div>
                    {rule.matchCount > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Applied {rule.matchCount} time{rule.matchCount !== 1 ? "s" : ""}
                      </div>
                    )}
                    {rule.lastMatched && (
                      <div className="text-xs text-muted-foreground">
                        Last matched {new Date(rule.lastMatched).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Edit Rule Dialog */}
      <RuleDialog
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(undefined)}
        rule={editingRule}
        onSuccess={() => setEditingRule(undefined)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRule} onOpenChange={(open) => !open && setDeletingRule(undefined)}>
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
              {deleteRule.isPending ? "Deleting..." : "Delete Rule"}
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
              This will apply all enabled rules to your existing transactions. This may take a few moments.
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>
              Apply All Rules
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}