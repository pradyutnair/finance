import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { CurrencyProvider } from "@/contexts/currency-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BanksPage() {
  return (
    <AuthGuard requireAuth={true}>
      <CurrencyProvider>
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
                  <div className="px-4 lg:px-6">
                    <div className="flex flex-col gap-4">
                      <div>
                        <h1 className="text-3xl font-bold tracking-tight">Banks</h1>
                        <p className="text-muted-foreground">
                          Manage your connected bank accounts and financial institutions.
                        </p>
                      </div>
                      <Card>
                        <CardHeader>
                          <CardTitle>Connected Banks</CardTitle>
                          <CardDescription>
                            View and manage your connected bank accounts
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground">
                            No banks connected yet. Connect your first bank account to get started.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </CurrencyProvider>
    </AuthGuard>
  )
}
