"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Settings, Play, Check } from "lucide-react"
import { useTestTransactionRule } from "@/lib/api/transaction-rules"
import type { TransactionRuleCondition, TransactionRuleAction, TransactionRuleTestResult } from "@/lib/types/transaction-rules"
import { CATEGORY_OPTIONS } from "@/lib/categories"

interface RuleBuilderProps {
  rule: {
    name: string
    description?: string
    enabled: boolean
    priority: number
    conditions: TransactionRuleCondition[]
    conditionLogic?: 'AND' | 'OR'
    actions: TransactionRuleAction[]
  }
  onChange: (updates: any) => void
  onTest?: (result: TransactionRuleTestResult) => void
  disabled?: boolean
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
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "does not equal" },
    { value: "contains", label: "contains" },
    { value: "notContains", label: "does not contain" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
  ],
  number: [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "does not equal" },
    { value: "greaterThan", label: "greater than" },
    { value: "lessThan", label: "less than" },
    { value: "greaterThanOrEqual", label: "greater than or equal to" },
    { value: "lessThanOrEqual", label: "less than or equal to" },
  ],
  date: [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "does not equal" },
    { value: "greaterThan", label: "after" },
    { value: "lessThan", label: "before" },
    { value: "greaterThanOrEqual", label: "on or after" },
    { value: "lessThanOrEqual", label: "on or before" },
  ],
}

const ACTION_TYPES = [
  { value: "setCategory", label: "Set category to" },
  { value: "setExclude", label: "Set exclude to" },
  { value: "setDescription", label: "Set description to" },
  { value: "setCounterparty", label: "Set payee to" },
]

export function RuleBuilder({ rule, onChange, onTest, disabled }: RuleBuilderProps) {
  const [isTesting, setIsTesting] = useState(false)
  const testRule = useTestTransactionRule()
  const [lastTestResult, setLastTestResult] = useState<TransactionRuleTestResult | null>(null)

  function addCondition() {
    const newCondition: TransactionRuleCondition = {
      field: "counterparty",
      operator: "contains",
      value: "",
      caseSensitive: false,
    }
    onChange({
      conditions: [...rule.conditions, newCondition],
    })
  }

  function updateCondition(index: number, updates: Partial<TransactionRuleCondition>) {
    const newConditions = [...rule.conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    onChange({ conditions: newConditions })
  }

  function removeCondition(index: number) {
    const newConditions = rule.conditions.filter((_, i) => i !== index)
    onChange({ conditions: newConditions })
  }

  function addAction() {
    const newAction: TransactionRuleAction = {
      type: "setCategory",
      value: "",
    }
    onChange({
      actions: [...rule.actions, newAction],
    })
  }

  function updateAction(index: number, updates: Partial<TransactionRuleAction>) {
    const newActions = [...rule.actions]
    newActions[index] = { ...newActions[index], ...updates }
    onChange({ actions: newActions })
  }

  function removeAction(index: number) {
    const newActions = rule.actions.filter((_, i) => i !== index)
    onChange({ actions: newActions })
  }

  async function handleTestRule() {
    if (rule.conditions.length === 0 || rule.actions.length === 0) {
      return
    }

    setIsTesting(true)
    try {
      const result = await testRule.mutateAsync({
        rule: {
          name: rule.name,
          description: rule.description,
          enabled: rule.enabled,
          priority: rule.priority,
          conditions: rule.conditions,
          conditionLogic: rule.conditionLogic || "AND",
          actions: rule.actions,
        },
      })
      setLastTestResult(result)
      onTest?.(result)
    } catch (error) {
      console.error("Error testing rule:", error)
    } finally {
      setIsTesting(false)
    }
  }

  function getOperatorsForField(field: string) {
    if (field === "amount") return OPERATORS.number
    if (field === "bookingDate") return OPERATORS.date
    return OPERATORS.text
  }

  function renderConditionInput(condition: TransactionRuleCondition, index: number) {
    const field = condition.field

    if (field === "amount") {
      return (
        <Input
          type="number"
          step="0.01"
          placeholder="Enter amount..."
          value={condition.value as number}
          onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) || 0 })}
          disabled={disabled}
        />
      )
    }

    if (field === "bookingDate") {
      return (
        <Input
          type="date"
          value={condition.value as string}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          disabled={disabled}
        />
      )
    }

    if (field === "category") {
      return (
        <Select
          value={condition.value as string}
          onValueChange={(value) => updateCondition(index, { value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <div className="space-y-2">
        <Input
          placeholder={`Enter ${field}...`}
          value={condition.value as string}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          disabled={disabled}
        />
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`case-sensitive-${index}`}
            checked={condition.caseSensitive}
            onCheckedChange={(checked) => updateCondition(index, { caseSensitive: !!checked })}
            disabled={disabled}
          />
          <Label htmlFor={`case-sensitive-${index}`} className="text-sm">
            Case sensitive
          </Label>
        </div>
      </div>
    )
  }

  function renderActionInput(action: TransactionRuleAction, index: number) {
    if (action.type === "setExclude") {
      return (
        <Select
          value={action.value.toString()}
          onValueChange={(value) => updateAction(index, { value: value === "true" })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True (exclude)</SelectItem>
            <SelectItem value="false">False (include)</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if (action.type === "setCategory") {
      return (
        <Select
          value={action.value as string}
          onValueChange={(value) => updateAction(index, { value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <Input
        placeholder="Enter value..."
        value={action.value as string}
        onChange={(e) => updateAction(index, { value: e.target.value })}
        disabled={disabled}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Rule Name and Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rule Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              placeholder="Enter rule name..."
              value={rule.name}
              onChange={(e) => onChange({ name: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-description">Description (optional)</Label>
            <Input
              id="rule-description"
              placeholder="Describe what this rule does..."
              value={rule.description || ""}
              onChange={(e) => onChange({ description: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rule-enabled"
                checked={rule.enabled}
                onCheckedChange={(checked) => onChange({ enabled: !!checked })}
                disabled={disabled}
              />
              <Label htmlFor="rule-enabled">Enabled</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-priority">Priority</Label>
              <Input
                id="rule-priority"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={rule.priority}
                onChange={(e) => onChange({ priority: parseInt(e.target.value) || 0 })}
                disabled={disabled}
                className="w-20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conditions</CardTitle>
            <Button onClick={addCondition} disabled={disabled} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rule.conditions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No conditions added yet. Click "Add Condition" to create a condition for this rule.
            </div>
          ) : (
            <>
              {rule.conditions.length > 1 && (
                <div className="flex items-center space-x-2">
                  <Label>Combine conditions:</Label>
                  <Select
                    value={rule.conditionLogic || "AND"}
                    onValueChange={(value: "AND" | "OR") => onChange({ conditionLogic: value })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {rule.conditions.map((condition, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Condition {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(index)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field</Label>
                      <Select
                        value={condition.field}
                        onValueChange={(value) => updateCondition(index, { field: value as any, value: "" })}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Operator</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(index, { operator: value as any })}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorsForField(condition.field).map((operator) => (
                            <SelectItem key={operator.value} value={operator.value}>
                              {operator.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    {renderConditionInput(condition, index)}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Actions</CardTitle>
            <Button onClick={addAction} disabled={disabled} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rule.actions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No actions added yet. Click "Add Action" to specify what this rule should do.
            </div>
          ) : (
            rule.actions.map((action, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Action {index + 1}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Action Type</Label>
                    <Select
                      value={action.type}
                      onValueChange={(value) => updateAction(index, { type: value as any, value: "" })}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    {renderActionInput(action, index)}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Test Rule */}
      {rule.conditions.length > 0 && rule.actions.length > 0 && onTest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleTestRule}
              disabled={isTesting || testRule.isPending}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {isTesting ? "Testing..." : "Test Rule"}
            </Button>
            {testRule.error && (
              <p className="text-sm text-destructive mt-2">
                Error: {testRule.error.message}
              </p>
            )}
            {lastTestResult && (
              <div className="mt-2 text-sm text-muted-foreground">
                <strong>{lastTestResult.totalMatched}</strong> transaction{lastTestResult.totalMatched !== 1 ? "s" : ""} match{lastTestResult.totalMatched !== 1 ? "" : "es"} this rule
                {typeof lastTestResult.sampleSize === "number" && (
                  <span> · tested against {lastTestResult.sampleSize} transaction{lastTestResult.sampleSize !== 1 ? "s" : ""}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}