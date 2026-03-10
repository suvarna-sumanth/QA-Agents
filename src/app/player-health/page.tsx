"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HeartPulse, ShieldCheck, Timer, Zap, AlertTriangle, MonitorCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Progress } from "@/components/ui/progress";

export default function PlayerHealthPage() {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <HeartPulse className="h-8 w-8 text-rose-500" />
              Player Ecosystem Health
            </h1>
            <p className="text-muted-foreground">Real-time monitoring of player load times, ad delivery, and interaction metrics.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Global Uptime" 
              value="99.98%" 
              icon={ShieldCheck} 
              description="Last 30 days"
            />
            <StatCard 
              title="Avg Load Time" 
              value="1.2s" 
              icon={Timer} 
              trend={{ value: 0.4, isUp: true }}
              description="Target: < 2.0s"
            />
            <StatCard 
              title="Ad Fill Rate" 
              value="88.5%" 
              icon={Zap} 
              description="VAST/VMAP integration"
            />
            <StatCard 
              title="Total Faults" 
              value="14" 
              icon={AlertTriangle} 
              trend={{ value: 2, isUp: false }}
              description="Detected by agents"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorCheck className="h-5 w-5 text-primary" />
                  Browser Compatibility Matrix
                </CardTitle>
                <CardDescription>Success rates across major browser engines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Chromium (Chrome/Edge)</span>
                    <span className="font-bold">99.2%</span>
                  </div>
                  <Progress value={99.2} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">WebKit (Safari)</span>
                    <span className="font-bold">94.5%</span>
                  </div>
                  <Progress value={94.5} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Gecko (Firefox)</span>
                    <span className="font-bold">97.8%</span>
                  </div>
                  <Progress value={97.8} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Critical Health Alerts
                </CardTitle>
                <CardDescription>Anomalies detected in the last 6 hours.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex gap-3 text-rose-800 text-sm">
                    <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                    <div>
                      <p className="font-bold">Fortune - VAST Error 303</p>
                      <p className="opacity-80">Empty ad response detected on 4 articles. Redirect limit reached.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-3 text-amber-800 text-sm">
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-bold">Reuters - High Load Latency</p>
                      <p className="opacity-80">Scripts taking > 4s to initialize in Safari mobile viewports.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}