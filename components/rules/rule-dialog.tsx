"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RuleBuilder } from "./rule-builder"
import { useCreateTransactionRule, useUpdateTransactionRule } from "@/lib/api/transaction-rules"
import type { TransactionRule, TransactionRuleTestResult } from "@/lib/types/transaction-rules"
import { CheckCircle, AlertCircle, Play } from "lucide-react"

interface RuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: TransactionRule // If provided, edit mode; if not, create mode
  onSuccess?: () => void
}

export function RuleDialog({ open, onOpenChange, rule, onSuccess }: RuleDialogProps) {
  const [testResult, setTestResult] = useState<TransactionRuleTestResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createRule = useCreateTransactionRule()
  const updateRule = useUpdateTransactionRule()

  const isEditMode = !!rule
  const [ruleData, setRuleData] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    enabled: rule?.enabled ?? true,
    priority: rule?.priority ?? 0,
    conditions: rule?.conditions || [],
    conditionLogic: rule?.conditionLogic || ("AND" as const),
    actions: rule?.actions || [],
  })

  function handleRuleChange(updates: any) {
    setRuleData((prev) => ({ ...prev, ...updates }))
    // Clear test result when rule changes
    setTestResult(null)
  }

  function handleTestResult(result: TransactionRuleTestResult) {
    setTestResult(result)
  }

  async function handleSave() {
    if (!ruleData.name.trim()) {
      return
    }

    if (ruleData.conditions.length === 0) {
      return
    }

    if (ruleData.actions.length === 0) {
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditMode && rule) {
        await updateRule.mutateAsync({
          id: rule.id,
          ...ruleData,
        })
      } else {
        await createRule.mutateAsync(ruleData)
      }
      onSuccess?.()
      onOpenChange(false)
      // Reset form
      setRuleData({
        name: "",
        description: "",
        enabled: true,
        priority: 0,
        conditions: [],
        conditionLogic: "AND",
        actions: [],
      })
      setTestResult(null)
    } catch (error) {
      console.error("Error saving rule:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancel() {
    onOpenChange(false)
    // Reset form when canceling
    setRuleData({
      name: rule?.name || "",
      description: rule?.description || "",
      enabled: rule?.enabled ?? true,
      priority: rule?.priority ?? 0,
      conditions: rule?.conditions || [],
      conditionLogic: rule?.conditionLogic || "AND",
      actions: rule?.actions || [],
    })
    setTestResult(null)
  }

  const isValid = ruleData.name.trim() && ruleData.conditions.length > 0 && ruleData.actions.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[90vh] max-h-screen overflow-y-auto p-0 sm:max-w-6xl sm:w-[90vw] md:max-w-5xl lg:max-w-6xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-6 border-b">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold">
                {isEditMode ? "Edit Rule" : "Create New Rule"}
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                {isEditMode
                  ? "Modify the rule conditions and actions below."
                  : "Create a rule to automatically categorize or exclude transactions based on specific conditions."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
          <RuleBuilder
            rule={ruleData}
            onChange={handleRuleChange}
            onTest={handleTestResult}
            disabled={isSubmitting}
          />

          {/* Test Results moved inline with "Test Rule" section in RuleBuilder */}

          {/* Rule Summary */}
          {isValid && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-2">Rule Summary</h4>
              <div className="text-sm space-y-1">
                <p>
                  <strong>IF</strong>{" "}
                  {ruleData.conditions.map((condition, index) => {
                    let value = condition.value;
                    if (value instanceof Date) {
                      value = value.toISOString();
                    }
                    return (
                      <span key={index}>
                        {condition.field} {condition.operator.replace(/([A-Z])/g, ' $1').toLowerCase()}&nbsp;
                        &quot;{value}&quot;
                        {index < ruleData.conditions.length - 1 && (
                          <span className="mx-2 font-medium">{ruleData.conditionLogic}</span>
                        )}
                      </span>
                    );
                  })}
                </p>
                <p>
                  <strong>THEN</strong> {ruleData.actions.map((action, index) => (
                  <span key={index}>
                    {action.type.replace(/([A-Z])/g, ' $1').toLowerCase()} "{action.value}"
                    {index < ruleData.actions.length - 1 && ", "}
                  </span>
                ))}
                </p>
              </div>
            </div>
          )}
                  </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50">
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isValid || isSubmitting || createRule.isPending || updateRule.isPending}
                className="min-w-[120px]"
              >
                {isSubmitting
                  ? "Saving..."
                  : isEditMode
                  ? "Update Rule"
                  : "Create Rule"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}