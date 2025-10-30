"use client"

import { useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { DashboardThemeProvider } from "@/components/dashboard/theme-provider-wrapper"
import { CurrencyProvider } from "@/contexts/currency-context"
import { DateRangeProvider } from "@/contexts/date-range-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TransactionsTable } from "@/components/transactions/transactions-table"
import { RulesList } from "@/components/rules/rules-list"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { RecurringGrid } from "@/components/recurring/recurring-grid"
import { useRecurringTransactionsWithDateRange } from "@/hooks/use-recurring-transactions"
import { Table, Settings, RefreshCw } from "lucide-react"

// Separate component for recurring transactions that uses the date range context
function RecurringTransactionsTab() {
  const { patterns, isLoading, refetch } = useRecurringTransactionsWithDateRange()

  return (
    <RecurringGrid
      patterns={patterns}
      isLoading={isLoading}
      onRefresh={() => refetch()}
    />
  )
}

export default function TransactionsPage() {
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)

  function handleCreateRule() {
    setRuleDialogOpen(true)
  }

  return (
    <AuthGuard requireAuth={true}>
      <DashboardThemeProvider>
        <CurrencyProvider>
          <DateRangeProvider>
            <SidebarProvider
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 72)",
                  "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
              }
            >
              <AppSidebar variant="inset" />
              <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                  <div className="@container/main flex flex-1 flex-col gap-2 p-4 md:p-6">
                    <Tabs defaultValue="transactions" className="space-y-6">
                      <TabsList className="grid w-full grid-cols-3 h-12">
                        <TabsTrigger value="transactions" className="flex-1 rounded-xl border-none focus-visible:ring-[#40221a] dark:focus-visible:ring-white flex items-center gap-2 data-[state=active]:bg-[#40221a] data-[state=active]:text-white dark:data-[state=active]:bg-background dark:data-[state=active]:text-white">
                          <Table className="h-4 w-4" />
                          Transactions
                        </TabsTrigger>
                        <TabsTrigger value="rules" className="flex-1 rounded-xl border-none focus-visible:ring-[#40221a] dark:focus-visible:ring-white flex items-center gap-2 data-[state=active]:bg-[#40221a] data-[state=active]:text-white dark:data-[state=active]:bg-background dark:data-[state=active]:text-white">
                          <Settings className="h-4 w-4" />
                          Rules
                        </TabsTrigger>
                        <TabsTrigger value="recurring" className="flex-1 rounded-xl border-none focus-visible:ring-[#40221a] dark:focus-visible:ring-white flex items-center gap-2 data-[state=active]:bg-[#40221a] data-[state=active]:text-white dark:data-[state=active]:bg-background dark:data-[state=active]:text-white">
                          <RefreshCw className="h-4 w-4" />
                          Recurring
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="transactions" className="space-y-6">
                        <TransactionsTable />
                      </TabsContent>

                      <TabsContent value="rules" className="space-y-6">
                        
                        <RulesList onCreateRule={handleCreateRule} />
                      </TabsContent>

                      <TabsContent value="recurring" className="space-y-6">
                        <RecurringTransactionsTab />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                {/* Rule Dialog */}
                <RuleDialog
                  open={ruleDialogOpen}
                  onOpenChange={setRuleDialogOpen}
                  onSuccess={() => setRuleDialogOpen(false)}
                />
              </SidebarInset>
            </SidebarProvider>
          </DateRangeProvider>
        </CurrencyProvider>
      </DashboardThemeProvider>
    </AuthGuard>
  )
}
