"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TransactionsTable } from "@/components/transactions/transactions-table"
import { RecurringTransactionsTable } from "@/components/transactions/recurring-transactions-table"
import { RulesTable } from "@/components/rules/rules-table"
import { RuleDialogV2 } from "@/components/rules/rule-dialog-v2"
import { useQueryClient } from "@tanstack/react-query"
import type { TransactionRule } from "@/lib/types/transaction-rules"

type TabValue = "transactions" | "recurring" | "rules"

export function TransactionsTabs() {
  const [activeTab, setActiveTab] = useState<TabValue>("transactions")
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [transactionForRule, setTransactionForRule] = useState<any | null>(null)
  const [editingRule, setEditingRule] = useState<TransactionRule | undefined>(undefined)
  const queryClient = useQueryClient()

  function handleCreateRule() {
    setTransactionForRule(null)
    setEditingRule(undefined)
    setRuleDialogOpen(true)
  }

  function handleCreateRuleFromTransaction(transaction: any) {
    setTransactionForRule(transaction)
    setEditingRule(undefined)
    setRuleDialogOpen(true)
  }

  function handleEditRule(rule: TransactionRule) {
    setEditingRule(rule)
    setTransactionForRule(null)
    setRuleDialogOpen(true)
  }

  function handleRuleDialogSuccess() {
    setRuleDialogOpen(false)
    setTransactionForRule(null)
    setEditingRule(undefined)
    // Invalidate both transactions and rules queries to reflect changes
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["transaction-rules"] })
  }

  function handleRuleDialogOpenChange(open: boolean) {
    if (!open) {
      setTransactionForRule(null)
      setEditingRule(undefined)
    }
    setRuleDialogOpen(open)
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="h-full flex flex-col">
        <div className="px-4 lg:px-6 pt-4">
          <TabsList className="inline-flex">
            <TabsTrigger value="transactions">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="recurring">
              Recurring
            </TabsTrigger>
            <TabsTrigger value="rules">
              Rules
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="transactions" className="flex-1 overflow-hidden mt-4 px-4 lg:px-6">
          <TransactionsTable
            onCreateRule={handleCreateRule}
            onCreateRuleFromTransaction={handleCreateRuleFromTransaction}
          />
        </TabsContent>

        <TabsContent value="recurring" className="flex-1 overflow-hidden mt-4 px-4 lg:px-6">
          <RecurringTransactionsTable />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 overflow-hidden mt-4 px-4 lg:px-6">
          <RulesTable
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
          />
        </TabsContent>
      </Tabs>

      {/* Rule Dialog - shared between both tabs */}
      <RuleDialogV2
        open={ruleDialogOpen}
        onOpenChange={handleRuleDialogOpenChange}
        rule={editingRule || (transactionForRule ? {
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
        } : undefined)}
        onSuccess={handleRuleDialogSuccess}
      />
    </div>
  )
}
