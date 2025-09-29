"use client"

import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
  IconTrash,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { GradientAvatar } from "../profile-page/gradient-avatar"
import { useState } from "react"
import { getAuthHeader } from "@/lib/api"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, logout } = useAuth()
  const [isClearingCache, setIsClearingCache] = useState(false)

  if (!user) return null

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const clearAllCaches = async () => {
    if (!confirm('This will clear all caches and reload the page. Continue?')) {
      return
    }

    setIsClearingCache(true)
    try {
      // Clear browser storage first
      console.log('🧹 Clearing browser storage...')
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear service worker caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
        console.log('🧹 Cleared service worker caches:', cacheNames)
      }

      // Clear API caches
      console.log('🧹 Clearing API caches...')
      const authHeaders = await getAuthHeader()
      const response = await fetch('/api/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
      })

      const result = await response.json()
      
      if (result.ok) {
        console.log('✅ API caches cleared:', result.clearedCaches)
        
        // Force a hard reload to clear all HTTP caches
        console.log('🔄 Reloading page...')
        window.location.reload()
      } else {
        console.error('❌ Failed to clear API caches:', result.error)
        alert('Failed to clear API caches: ' + result.error)
        setIsClearingCache(false)
      }
    } catch (error) {
      console.error('❌ Error clearing caches:', error)
      alert('Error clearing caches: ' + (error as Error).message)
      setIsClearingCache(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <GradientAvatar name={user.name} height={32} width={32} fontSize="text-sm" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <GradientAvatar name={user.name} height={32} width={32} fontSize="text-sm" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
              
            <DropdownMenuSeparator /> */}
            <DropdownMenuItem 
              onClick={clearAllCaches}
              disabled={isClearingCache}
              className="text-orange-600 focus:text-orange-600"
            >
              <IconTrash />
              {isClearingCache ? "Clearing..." : "Clear All Caches"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
