"use client"

import { useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { DashboardThemeProvider } from "@/components/dashboard/theme-provider-wrapper"
import { DateRangeProvider } from "@/contexts/date-range-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { RulesList } from "@/components/rules/rules-list"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { Plus } from "lucide-react"

export default function RulesPage() {
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)

  function handleCreateRule() {
    setRuleDialogOpen(true)
  }

  return (
    <AuthGuard requireAuth={true}>
      <DashboardThemeProvider>
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
                <div className="@container/main flex flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                    {/* Header Section */}

                    {/* Rules List */}
                    <div className="px-4 lg:px-6">
                      <RulesList onCreateRule={handleCreateRule} />
                    </div>
                  </div>
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
      </DashboardThemeProvider>
    </AuthGuard>
  )
}