"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { CurrencyProvider } from "@/contexts/currency-context"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { ProfileService, UserProfile } from "@/lib/profile-service"
// Avatar upload intentionally removed
// Inline name editing implemented locally on this page
import { CurrencyPreferences } from "@/components/profile-page/currency-preferences"
import { Mail, Calendar, Settings } from "lucide-react"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const userProfile = await ProfileService.getUserProfile(user.$id)
        setProfile(userProfile)
      } catch (err) {
        console.error("Failed to load profile:", err)
        toast.error("Failed to load profile data")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [user])

  const [isEditingName, setIsEditingName] = useState(false)
  const [pendingName, setPendingName] = useState("")

  const startEditName = () => {
    setPendingName(profile?.name || user?.name || "")
    setIsEditingName(true)
  }

  const cancelEditName = () => {
    setIsEditingName(false)
  }

  const saveName = async () => {
    if (!user) return
    const next = pendingName.trim()
    if (!next || next.length < 2) return
    await ProfileService.updateName(user.$id, next)
    setProfile(p => (p ? { ...p, name: next } : p))
    setIsEditingName(false)
  }

  const handleCurrencyPreferencesUpdate = async (currencies: string[]) => {
    // No Appwrite writes for preferences; handled entirely in context/localStorage
    setProfile(p => (p ? { ...p, preferredCurrencies: currencies } : p))
  }

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
            <div className="flex-1 p-4 lg:p-6">
              {/* Page title (kept tiny + quiet) */}
              <div className="mb-4">
                <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
                <p className="text-sm text-muted-foreground">Manage your account</p>
              </div>

              {isLoading ? (
                <div className="grid gap-4 md:gap-6">
                  <Card className="rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <div className="flex-1 space-y-3">
                          <Skeleton className="h-6 w-40" />
                          <Skeleton className="h-4 w-72" />
                          <div className="flex gap-2">
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                          </div>
                        </div>
                        <Skeleton className="h-9 w-28 rounded-lg" />
                      </div>
                    </CardContent>
                  </Card>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-48 w-full rounded-2xl" />
                    <Skeleton className="h-48 w-full rounded-2xl" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:gap-6">
                  {/* --- Compact Profile Header Card --- */}
                  <Card className="rounded-2xl border-border/60 bg-background/60">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {isEditingName ? (
                              <div className="flex items-center gap-2">
                                <input
                                  className="h-9 rounded-md border px-3 text-sm bg-background"
                                  value={pendingName}
                                  onChange={(e) => setPendingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveName()
                                    if (e.key === 'Escape') cancelEditName()
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground"
                                  onClick={saveName}
                                >
                                  Save
                                </button>
                                <button
                                  className="h-9 rounded-md px-3 text-sm"
                                  onClick={cancelEditName}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="text-xl font-semibold leading-none">
                                  {profile?.name || user?.name || "Unnamed"}
                                </p>
                                <button
                                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                                  onClick={startEditName}
                                >
                                  Edit name
                                </button>
                              </>
                            )}
                            <Badge variant="secondary" className="rounded-full">
                              {profile?.role || "Member"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {user?.email ?? "No email"}
                            </span>
                            <span className="inline-flex items-center gap-1 ">
                              <Calendar className="h-4 w-4" />
                              Joined{" "}
                              {user?.$createdAt
                                ? new Date(user.$createdAt).toLocaleDateString(undefined, {
                                    month: "long",
                                    year: "numeric",
                                  })
                                : "—"}
                            </span>
                          </div>
                        </div>
                        {/* Inline name editor used above; external component removed */}
                      </div>
                    </CardContent>
                  </Card>

                  {/* --- Simple settings cards --- */}
                  <div className="grid gap-4 ">

                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Currency preferences
                        </CardTitle>
                        <CardDescription>
                          Choose the currencies you care about
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CurrencyPreferences
                          preferredCurrencies={
                            profile?.preferredCurrencies || ["EUR", "USD", "GBP"]
                          }
                          onCurrencyPreferencesUpdate={handleCurrencyPreferencesUpdate}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </CurrencyProvider>
    </AuthGuard>
  )
}