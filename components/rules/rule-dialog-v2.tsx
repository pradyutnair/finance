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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Play, X } from "lucide-react"
import { useCreateTransactionRule, useUpdateTransactionRule, useTestTransactionRule } from "@/lib/api/transaction-rules"
import type { TransactionRule, TransactionRuleCondition, TransactionRuleAction, TransactionRuleTestResult } from "@/lib/types/transaction-rules"
import { CATEGORY_OPTIONS } from "@/lib/categories"

interface RuleDialogV2Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: TransactionRule
  onSuccess?: () => void
}

const FIELD_OPTIONS = [
  { value: "counterparty", label: "Payee" },
  { value: "description", label: "Description" },
  { value: "amount", label: "Amount" },
  { value: "bookingDate", label: "Date" },
  { value: "category", label: "Category" },
]

const OPERATORS = {
  text: [
    { value: "equals", label: "is" },
    { value: "notEquals", label: "is not" },
    { value: "contains", label: "contains" },
    { value: "notContains", label: "does not contain" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "notEquals", label: "≠" },
    { value: "greaterThan", label: ">" },
    { value: "lessThan", label: "<" },
    { value: "greaterThanOrEqual", label: "≥" },
    { value: "lessThanOrEqual", label: "≤" },
  ],
  date: [
    { value: "equals", label: "is" },
    { value: "notEquals", label: "is not" },
    { value: "greaterThan", label: "after" },
    { value: "lessThan", label: "before" },
    { value: "greaterThanOrEqual", label: "on or after" },
    { value: "lessThanOrEqual", label: "on or before" },
  ],
}

const ACTION_TYPES = [
  { value: "setCategory", label: "Set category" },
  { value: "setExclude", label: "Exclude" },
  { value: "setDescription", label: "Set description" },
  { value: "setCounterparty", label: "Set payee" },
]

export function RuleDialogV2({ open, onOpenChange, rule, onSuccess }: RuleDialogV2Props) {
  const [testResult, setTestResult] = useState<TransactionRuleTestResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const createRule = useCreateTransactionRule()
  const updateRule = useUpdateTransactionRule()
  const testRule = useTestTransactionRule()

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
    setTestResult(null)
  }

  async function handleTest() {
    if (ruleData.conditions.length === 0 || ruleData.actions.length === 0) return

    setIsTesting(true)
    try {
      const result = await testRule.mutateAsync({ rule: ruleData })
      setTestResult(result)
    } catch {
      // Error handling
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSave() {
    if (!ruleData.name.trim() || ruleData.conditions.length === 0 || ruleData.actions.length === 0) {
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditMode && rule) {
        await updateRule.mutateAsync({ id: rule.id, ...ruleData })
      } else {
        await createRule.mutateAsync(ruleData)
      }
      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch {
      // Error handling
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
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
  }

  function addCondition() {
    setRuleData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { field: "counterparty", operator: "contains", value: "", caseSensitive: false }
      ]
    }))
  }

  function updateCondition(index: number, updates: Partial<TransactionRuleCondition>) {
    setRuleData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    }))
  }

  function removeCondition(index: number) {
    setRuleData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }))
  }

  function addAction() {
    setRuleData((prev) => ({
      ...prev,
      actions: [...prev.actions, { type: "setCategory", value: "" }]
    }))
  }

  function updateAction(index: number, updates: Partial<TransactionRuleAction>) {
    setRuleData((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === index ? { ...a, ...updates } : a))
    }))
  }

  function removeAction(index: number) {
    setRuleData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }))
  }

  function getOperatorsForField(field: string) {
    if (field === "amount") return OPERATORS.number
    if (field === "bookingDate") return OPERATORS.date
    return OPERATORS.text
  }

  function renderConditionValue(condition: TransactionRuleCondition, index: number) {
    if (condition.field === "amount") {
      return (
        <Input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={condition.value as number}
          onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) || 0 })}
          className="h-8"
        />
      )
    }

    if (condition.field === "bookingDate") {
      return (
        <Input
          type="date"
          value={condition.value as string}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          className="h-8"
        />
      )
    }

    if (condition.field === "category") {
      return (
        <Select value={condition.value as string} onValueChange={(v) => updateCondition(index, { value: v })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <div className="space-y-1">
        <Input
          placeholder={`Enter ${condition.field}...`}
          value={condition.value as string}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          className="h-8"
        />
        <div className="flex items-center gap-2 text-xs">
          <Checkbox
            id={`case-${index}`}
            checked={condition.caseSensitive}
            onCheckedChange={(c) => updateCondition(index, { caseSensitive: !!c })}
            className="h-3 w-3"
          />
          <Label htmlFor={`case-${index}`} className="text-xs text-muted-foreground">Case sensitive</Label>
        </div>
      </div>
    )
  }

  function renderActionValue(action: TransactionRuleAction, index: number) {
    if (action.type === "setExclude") {
      return (
        <Select value={action.value.toString()} onValueChange={(v) => updateAction(index, { value: v === "true" })}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Exclude</SelectItem>
            <SelectItem value="false">Include</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if (action.type === "setCategory") {
      return (
        <Select value={action.value as string} onValueChange={(v) => updateAction(index, { value: v })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <Input
        placeholder="Value"
        value={action.value as string}
        onChange={(e) => updateAction(index, { value: e.target.value })}
        className="h-8"
      />
    )
  }

  const isValid = ruleData.name.trim() && ruleData.conditions.length > 0 && ruleData.actions.length > 0
  const hasEmptyValues = ruleData.conditions.some(c => c.value === "") || ruleData.actions.some(a => a.value === "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-2">
          <DialogTitle>{isEditMode ? "Edit Rule" : "New Rule"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isEditMode ? "Update rule conditions and actions." : "Auto-categorize transactions matching these conditions."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Netflix subscription"
              value={ruleData.name}
              onChange={(e) => handleRuleChange({ name: e.target.value })}
              className="h-9"
            />
          </div>

          <Tabs defaultValue="conditions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conditions" className="text-xs">
                Conditions ({ruleData.conditions.length})
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">
                Actions ({ruleData.actions.length})
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conditions" className="space-y-3 mt-3">
              {ruleData.conditions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No conditions. Add one to define when this rule applies.
                </div>
              ) : (
                <div className="space-y-2">
                  {ruleData.conditions.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Match:</span>
                      <Select
                        value={ruleData.conditionLogic}
                        onValueChange={(v: "AND" | "OR") => handleRuleChange({ conditionLogic: v })}
                      >
                        <SelectTrigger className="h-7 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">All</SelectItem>
                          <SelectItem value="OR">Any</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {ruleData.conditions.map((condition, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 rounded-md border bg-card">
                      <div className="flex-1 grid grid-cols-[120px,1fr] gap-2">
                        <Select value={condition.field} onValueChange={(v) => updateCondition(index, { field: v as any, value: "" })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="space-y-1">
                          <Select value={condition.operator} onValueChange={(v) => updateCondition(index, { operator: v as any })}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorsForField(condition.field).map((op) => (
                                <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {renderConditionValue(condition, index)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeCondition(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={addCondition}
                className="w-full h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Condition
              </Button>
            </TabsContent>

            <TabsContent value="actions" className="space-y-3 mt-3">
              {ruleData.actions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No actions. Add one to define what the rule does.
                </div>
              ) : (
                <div className="space-y-2">
                  {ruleData.actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                      <Select
                        value={action.type}
                        onValueChange={(v) => updateAction(index, { type: v as any, value: "" })}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        {renderActionValue(action, index)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeAction(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={addAction}
                className="w-full h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Action
              </Button>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Enabled</Label>
                  <p className="text-xs text-muted-foreground">Apply this rule to transactions</p>
                </div>
                <Switch
                  checked={ruleData.enabled}
                  onCheckedChange={(c) => handleRuleChange({ enabled: c })}
                  className="data-[state=checked]:bg-[#40221a]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs">Priority (0-100)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="100"
                  value={ruleData.priority}
                  onChange={(e) => handleRuleChange({ priority: parseInt(e.target.value) || 0 })}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">Higher priority rules run first</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="What does this rule do?"
                  value={ruleData.description || ""}
                  onChange={(e) => handleRuleChange({ description: e.target.value })}
                  className="h-9"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Test Result */}
          {testResult && (
            <div className="p-2 rounded-md bg-muted text-sm">
              <span className="font-medium">{testResult.totalMatched}</span>
              {" "}transaction{testResult.totalMatched !== 1 ? "s" : ""} matched
              {typeof testResult.sampleSize === "number" && (
                <span className="text-muted-foreground"> (tested {testResult.sampleSize})</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {isValid && !hasEmptyValues && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || testRule.isPending}
              className="flex-1"
            >
              <Play className="h-3 w-3 mr-1" />
              Test
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isValid || hasEmptyValues || isSubmitting}>
            {isSubmitting ? "Saving..." : isEditMode ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
