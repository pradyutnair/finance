"use client"

import * as React from "react"
import {
  IconDashboard,
  IconCreditCard,
  IconArrowsUpDown,
  IconUser,
  IconInnerShadowTop,
  IconChevronRight,
} from "@tabler/icons-react"

import { NavMain } from "@/components/sidebar/nav-main"
import { NavUser } from "@/components/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Image from "next/image"
const data = {
  user: {
    name: "John Doe",
    email: "john@example.com",
    avatar: "/favicon.ico",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Banks",
      url: "/banks",
      icon: IconCreditCard,
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: IconArrowsUpDown,
    },
    {
      title: "Profile",
      url: "/profile",
      icon: IconUser,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar 
      collapsible="offcanvas" 
      className="border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      {...props}
    >
      <SidebarHeader className="border-b border-border/40 bg-gradient-to-b from-[#40221a]/[0.03] to-transparent dark:from-white/[0.03]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="
                group
                data-[slot=sidebar-menu-button]:!p-3
                hover:bg-[#40221a]/5 dark:hover:bg-white/5
                transition-all duration-200
              "
            >
              <a href="#" className="flex items-center gap-3">
                <Image
                  src="/android-chrome-512x512.png"
                  alt="NexPass Logo"
                  width={20}
                  height={20}
                  className="rounded-lg object-cover w-8 h-8"
                />
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight text-[#40221a] dark:text-white">
                    NexPass
                  </span>
                  
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <div className="mb-2 px-3 py-1">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Menu
          </p>
        </div>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 bg-gradient-to-t from-[#40221a]/[0.02] to-transparent dark:from-white/[0.02] mt-auto">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}