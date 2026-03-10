
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Globe, 
  PlayCircle, 
  Bug, 
  Mic2, 
  HeartPulse, 
  Activity,
  Settings,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Publisher Sites", href: "/sites", icon: Globe },
  { name: "QA Runs", href: "/runs", icon: PlayCircle },
  { name: "Bug Reports", href: "/bugs", icon: Bug },
];

const analysisNavItems = [
  { name: "Audio Quality", href: "/audio-quality", icon: Mic2 },
  { name: "Player Health", href: "/player-health", icon: HeartPulse },
  { name: "Agent Activity", href: "/agent-activity", icon: Activity },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-16 flex items-center px-4 border-b">
        <div className="flex items-center gap-2 font-bold text-primary group-data-[collapsible=icon]:hidden">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-xl tracking-tight">AudioPulse</span>
        </div>
        <ShieldCheck className="h-6 w-6 text-primary group-data-[collapsible=none]:hidden group-data-[collapsible=icon]:block hidden" />
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Analysis & Monitoring</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisNavItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
