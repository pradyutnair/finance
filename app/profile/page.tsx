"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
// Uses global CurrencyProvider from app/layout.tsx
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { ProfileService, UserProfile } from "@/lib/profile-service"
// Avatar upload intentionally removed
// Inline name editing implemented locally on this page
import { CurrencyPreferences } from "@/components/profile-page/currency-preferences"
import { Mail, Calendar, Settings, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRef } from "react"
import { Camera, Wand2 } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { GradientAvatar } from "@/components/profile-page/gradient-avatar"


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
              {/* <div className="mb-4">
                <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
                <p className="text-sm text-muted-foreground">Manage your account</p>
              </div> */}

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
                        {/* LEFT: name + meta */}
                        <div className="space-y-1">
                          {/* LEFT: avatar + name + meta */}
                          <div className="flex items-center gap-4">
                            <GradientAvatar name={profile?.name || user?.name} />

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {!isEditingName ? (
                                  <p className="text-xl font-semibold leading-none">
                                    {profile?.name || user?.name || "Unnamed"}
                                  </p>
                                ) : (
                                  <input
                                    className="h-9 rounded-md border px-3 text-sm bg-background"
                                    value={pendingName}
                                    onChange={(e) => setPendingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveName()
                                      if (e.key === "Escape") cancelEditName()
                                    }}
                                    autoFocus
                                  />
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
                                <span className="inline-flex items-center gap-1">
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
                          </div>
                        </div>

                      {/* RIGHT: action buttons */}
                      {!isEditingName ? (
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={() => {
                            setPendingName(profile?.name || user?.name || "")
                            setIsEditingName(true)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Profile
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="rounded-xl" onClick={saveName}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={cancelEditName}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                  {/* --- Simple settings cards --- */}
                  <div className="grid gap-4 ">

                        <CurrencyPreferences
                          preferredCurrencies={
                            profile?.preferredCurrencies || ["EUR", "USD", "GBP"]
                          }
                          onCurrencyPreferencesUpdate={handleCurrencyPreferencesUpdate}
                        />
                  </div>
                </div>
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
    </AuthGuard>
  )
}