import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { CurrencyProvider } from "@/contexts/currency-context"
import { DateRangeProvider } from "@/contexts/date-range-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionsTable } from "@/components/transactions/transactions-table"

export default function TransactionsPage() {
  return (
    <AuthGuard requireAuth={true}>
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
                <TransactionsTable />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
        </DateRangeProvider>
      </CurrencyProvider>
    </AuthGuard>
  )
}
