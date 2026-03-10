"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Cpu, Database, Network, Server, UserCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const activityLogs = [
  { time: "14:32:01", agent: "Shivani-W1", action: "DOM_PLAYER_DETECTED", status: "success", detail: "Found selector #article-audio-player on thehill.com" },
  { time: "14:31:55", agent: "HoneyGrace-M1", action: "TRANSCRIPTION_START", status: "info", detail: "Processing 4:12 audio file article_id_292" },
  { time: "14:31:40", agent: "Shivani-Orchestrator", action: "TASK_ASSIGNED", status: "info", detail: "Assigned Reuters full-site QA to Swarm B" },
  { time: "14:30:12", agent: "HoneyGrace-W4", action: "WER_CALCULATION", status: "success", detail: "WER: 0.023 for MarketWatch editorial" },
  { time: "14:28:55", agent: "Shivani-W2", action: "AD_EVENT_PLAYBACK", status: "warning", detail: "Delayed start for mid-roll ad on Fortune" },
];

export default function AgentActivityPage() {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <Activity className="h-8 w-8 text-accent" />
              Agent Swarm Activity
            </h1>
            <p className="text-muted-foreground">Live telemetry and coordination logs from Shivani and Honey Grace agents.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Active Workers" value="18" icon={Cpu} description="Shivani (8) / Honey Grace (10)" />
            <StatCard title="Memory Usage" value="4.2 GB" icon={Server} description="Total swarm footprint" />
            <StatCard title="Network IO" value="124 Mbps" icon={Network} description="Audio streaming ingestion" />
            <StatCard title="Task Queue" value="142" icon={Database} description="Pending article evaluations" />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Real-time Execution Stream
                </CardTitle>
                <CardDescription>Raw events from worker nodes across the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {activityLogs.map((log, i) => (
                      <div key={i} className="flex gap-4 p-3 rounded-lg border bg-muted/30 text-sm">
                        <span className="text-muted-foreground font-code shrink-0">{log.time}</span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{log.agent}</span>
                            <Badge variant="outline" className="text-[10px] h-4 py-0 uppercase">{log.action}</Badge>
                          </div>
                          <p className="text-foreground/80">{log.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm uppercase font-bold text-muted-foreground">System Load</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                  <div className="relative h-32 w-32">
                    <svg className="h-full w-full" viewBox="0 0 100 100">
                      <circle className="text-muted stroke-current" strokeWidth="10" fill="transparent" r="40" cx="50" cy="50" />
                      <circle className="text-accent stroke-current" strokeWidth="10" strokeDasharray="251.2" strokeDashoffset="62.8" strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">75%</span>
                      <span className="text-[10px] uppercase text-muted-foreground">Capacity</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle className="text-base">Master Coordination</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Orchestrator Nodes</span>
                    <Badge variant="secondary">2 Online</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Task Distribution</span>
                    <Badge variant="secondary">Balanced</Badge>
                  </div>
                  <p className="opacity-70 text-xs italic">
                    All agents are currently operating within nominal latency parameters. Next swarm rotation in 42 minutes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}