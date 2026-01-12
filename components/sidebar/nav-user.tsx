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
import { useCacheInvalidation } from "@/hooks/useCacheInvalidation"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, logout } = useAuth()
  const [isClearingCache, setIsClearingCache] = useState(false)
  const { invalidateAll } = useCacheInvalidation()

  if (!user) return null

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const clearAllCaches = async () => {
    if (!confirm('This will clear all caches and reload the page. Continue?')) {
      return
    }

    setIsClearingCache(true)
    
    // Clear browser storage first
    console.log('🧹 Clearing browser storage...')
    localStorage.clear()
    sessionStorage.clear()
    
    // Clear service worker caches if available
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
        console.log('🧹 Cleared service worker caches:', cacheNames)
      } catch (error) {
        console.warn('⚠️ Could not clear service worker caches:', error)
      }
    }

    // Use centralized cache invalidation
    console.log('🧹 Invalidating all caches...')
    const result = await invalidateAll({ 
      scope: 'all', 
      reason: 'manual-clear-all',
      silent: false 
    })
    
    if (result.overall) {
      console.log('✅ All caches cleared')
    } else {
      console.warn('⚠️ Some caches could not be cleared:', result)
      // Continue anyway - partial clearing is better than none
    }
    
    // Force a hard reload to clear all HTTP caches
    console.log('🔄 Reloading page...')
    window.location.reload()
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
            {/* <DropdownMenuItem 
              onClick={clearAllCaches}
              disabled={isClearingCache}
              className="text-orange-600 focus:text-orange-600"
            >
              <IconTrash />
              {isClearingCache ? "Clearing..." : "Clear All Caches"}
            </DropdownMenuItem>
            <DropdownMenuSeparator /> */}
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
