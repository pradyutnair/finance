"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { ProfileService, UserProfile } from "@/lib/profile-service"
import { GDPRDashboard } from "@/components/gdpr/gdpr-dashboard"
import { toast } from "sonner"
import { Mail, Calendar } from "lucide-react"
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
          <div className="flex-1 p-4 lg:p-6 space-y-6">
            {isLoading ? (
              <div className="space-y-6">
                <Card className="rounded-3xl border-[#40221a]/10 dark:border-white/10 shadow-sm overflow-hidden">
                  <CardContent className="p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      <Skeleton className="h-24 w-24 rounded-2xl" />
                      <div className="flex-1 space-y-4 w-full">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-5 w-64" />
                        <div className="flex gap-2">
                          <Skeleton className="h-7 w-24 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Skeleton className="h-96 w-full rounded-3xl" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Profile Header Card */}
                <Card className="rounded-3xl border-[#40221a]/10 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden bg-gradient-to-br from-white to-[#40221a]/[0.02] dark:from-background dark:to-background">
                  <CardContent className="p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      {/* Avatar Section */}
                      <div className="relative group">
                        <GradientAvatar 
                          name={profile?.name || user?.name} 
                          className="h-24 w-24 text-2xl"
                        />
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#40221a]/0 to-[#40221a]/5 dark:from-white/0 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>

                      {/* Profile Info */}
                      <div className="flex-1 space-y-3 w-full">
                        <div className="flex flex-wrap items-center gap-3">
                          <h1 className="text-3xl font-bold tracking-tight text-[#40221a] dark:text-white">
                            {profile?.name || user?.name || "Unnamed"}
                          </h1>
                          <Badge 
                            variant="secondary" 
                            className="rounded-full px-3 py-1 bg-[#40221a]/10 dark:bg-white/10 text-[#40221a] dark:text-white border-[#40221a]/20 dark:border-white/20"
                          >
                            {profile?.role || "Member"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-[#40221a]/70 dark:text-white/70">
                          <span className="inline-flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {user?.email ?? "No email"}
                          </span>
                          <span className="inline-flex items-center gap-2">
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
                  </CardContent>
                </Card>

                {/* GDPR Dashboard */}
                <GDPRDashboard />
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}