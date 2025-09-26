import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
import { AiChatCard } from "@/components/chat/ai-chat-card"
import { RecentExpensesTable } from "@/components/dashboard/recent-expenses-table"
import { ExpenseChart } from "@/components/dashboard/expense-chart"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { DateRangeProvider } from "@/contexts/date-range-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function Page() {
  return (
    <AuthGuard requireAuth={true}>
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
                  <SectionCards />
                  <div className="px-4 lg:px-6">
                    <ChartAreaInteractive />
                  </div>
                  <div className="px-4 lg:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px]">
                      <div className="md:col-span-2 lg:col-span-1">
                        <AiChatCard />
                      </div>
                      <div className="md:col-span-1 lg:col-span-1">
                        <RecentExpensesTable />
                      </div>
                      <div className="md:col-span-1 lg:col-span-1">
                        <ExpenseChart />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DateRangeProvider>
    </AuthGuard>
  )
}
