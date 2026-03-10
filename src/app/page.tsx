"use client";

import { 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  BarChart3,
  Waves,
  Loader2
} from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useUser, useAuth, initiateAnonymousSignIn } from "@/firebase";

// Mock data for initial state
const INITIAL_RUNS = [
  { id: 'run-1', site: 'the-hill', agent: 'Honey Grace', status: 'completed', wer: 0.02, health: 98 },
  { id: 'run-2', site: 'reuters', agent: 'Shivani', status: 'completed', wer: 0.05, health: 92 },
  { id: 'run-3', site: 'fortune', agent: 'Honey Grace', status: 'completed', wer: 0.03, health: 95 },
  { id: 'run-4', site: 'verge', agent: 'Shivani', status: 'completed', wer: 0.12, health: 85 },
];

export default function DashboardPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [runs, setRuns] = useState(INITIAL_RUNS);
  const [isSimulating, setIsSimulating] = useState(false);

  // 1. Handle Automatic Anonymous Sign-in for context
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // 2. Simulate Background Agent Activity
  useEffect(() => {
    const interval = setInterval(() => {
      // Occasionally add a "pending" run to simulate live activity
      if (Math.random() > 0.7 && !isSimulating) {
        const newId = `run-${Date.now()}`;
        const sites = ['the-hill', 'reuters', 'fortune', 'verge', 'marketwatch'];
        const randomSite = sites[Math.floor(Math.random() * sites.length)];
        
        const pendingRun = { 
          id: newId, 
          site: randomSite, 
          agent: 'Shivani', 
          status: 'pending', 
          wer: 0, 
          health: 0 
        };
        
        setRuns(prev => [pendingRun, ...prev].slice(0, 6));
        setIsSimulating(true);

        // Complete the run after 5 seconds
        setTimeout(() => {
          setRuns(currentRuns => currentRuns.map(r => 
            r.id === newId 
              ? { ...r, status: 'completed', wer: 0.04, health: 96, agent: 'Honey Grace' } 
              : r
          ));
          setIsSimulating(false);
        }, 5000);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Initializing QA Environment...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="bg-background/50">
        <div className="flex flex-col flex-1 p-6 gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline text-foreground">Dashboard Overview</h1>
            <p className="text-muted-foreground">Monitor real-time QA automation results across your publisher ecosystem.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Total Sites" 
              value="42" 
              icon={Globe} 
              description="Active publishers"
            />
            <StatCard 
              title="Success Rate" 
              value="94.2%" 
              icon={CheckCircle2} 
              trend={{ value: 1.2, isUp: true }}
              description="Avg. Health"
            />
            <StatCard 
              title="Active Bugs" 
              value="7" 
              icon={AlertTriangle} 
              trend={{ value: 3, isUp: false }}
              description="Requiring review"
            />
            <StatCard 
              title="Agent Load" 
              value={isSimulating ? "82%" : "64%"} 
              icon={Cpu} 
              description="System utilization"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Live QA Activity
                </CardTitle>
                <CardDescription>Real-time results from Shivani and Honey Grace agents.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Metrics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium capitalize">
                          {run.site.replace('-', ' ')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={run.status === 'pending' ? "border-primary/20 bg-primary/5 text-primary" : "border-accent/20 bg-accent/5 text-accent"}>
                            {run.agent}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {run.status === 'pending' ? (
                              <>
                                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-sm">In Progress...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm font-medium text-emerald-600">Completed</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {run.status === 'pending' ? (
                            <span className="text-xs text-muted-foreground italic">Analyzing...</span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold">WER: {run.wer}</span>
                              <Progress value={run.health} className="h-1 w-16" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-accent" />
                  Agent Swarm Health
                </CardTitle>
                <CardDescription>Status of worker nodes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Shivani Workers</span>
                    <span className="text-muted-foreground">8/8 Active</span>
                  </div>
                  <Progress value={100} className="h-2 bg-muted" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="h-3 w-3 rounded-sm bg-emerald-500" />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Honey Grace Workers</span>
                    <span className="text-muted-foreground">9/10 Active</span>
                  </div>
                  <Progress value={90} className="h-2" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <div key={i} className="h-3 w-3 rounded-sm bg-emerald-500" />
                    ))}
                    <div className="h-3 w-3 rounded-sm bg-rose-500 animate-pulse" />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-accent/5 border border-accent/10 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-accent">Status Update</h4>
                  <p className="text-sm text-foreground/80">
                    {isSimulating 
                      ? "Swarm is currently processing playback telemetry for selected articles." 
                      : "Swarm standby. All agents ready for task assignment."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
