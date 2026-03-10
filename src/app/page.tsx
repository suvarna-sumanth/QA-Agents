
"use client";

import { 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  BarChart3,
  Waves,
  Loader2,
  Terminal,
  BrainCircuit
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
import { useEffect, useState, useRef } from "react";
import { useUser, useAuth, initiateAnonymousSignIn } from "@/firebase";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [agentLogs, setAgentLogs] = useState<string[]>(["[SYSTEM] Dashboard initialized. Swarm ready."]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Simulate Background Agent Activity
  useEffect(() => {
    const interval = setInterval(() => {
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
        
        setAgentLogs(prev => [...prev, `[ORCHESTRATOR] Dispatching agents to ${randomSite}...`]);
        
        setTimeout(() => setAgentLogs(prev => [...prev, `[SHIVANI] Locating player on ${randomSite} article...`]), 1000);
        setTimeout(() => setAgentLogs(prev => [...prev, `[HONEY GRACE] Audio stream detected. Starting transcription...`]), 2500);
        setTimeout(() => setAgentLogs(prev => [...prev, `[HONEY GRACE] Analysis complete. High fidelity (WER 0.04) detected.`]), 4000);

        // Complete the run after 5 seconds
        setTimeout(() => {
          setRuns(currentRuns => currentRuns.map(r => 
            r.id === newId 
              ? { ...r, status: 'completed', wer: 0.04, health: 96, agent: 'Honey Grace' } 
              : r
          ));
          setIsSimulating(false);
          setAgentLogs(prev => [...prev, `[SYSTEM] QA Run ${newId.slice(-4)} finalized. Results synced.`]);
        }, 5000);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Initializing Swarm Environment...</p>
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
              title="Agent Swarm" 
              value={isSimulating ? "Active" : "Standby"} 
              icon={Cpu} 
              className={isSimulating ? "ring-2 ring-primary animate-pulse" : ""}
              description={isSimulating ? "Processing tasks..." : "Ready for tasking"}
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
                                <span className="text-sm">Analyzing...</span>
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
                            <div className="flex justify-end">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
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

            <div className="lg:col-span-3 space-y-6">
              <Card className="border-none shadow-sm bg-sidebar text-sidebar-foreground">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Terminal className="h-5 w-5" />
                    Agent Swarm Log
                  </CardTitle>
                  <CardDescription className="text-sidebar-foreground/60">Live execution telemetry.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px] w-full rounded-md border border-sidebar-border bg-black/20 p-4">
                    <div className="space-y-2 font-code text-xs">
                      {agentLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-emerald-500 shrink-0">➜</span>
                          <span className={log.startsWith('[SYSTEM]') ? 'text-primary' : 'text-sidebar-foreground/80'}>
                            {log}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-accent/10 border border-accent/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-accent" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Connectivity</span>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5">Nominal</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">GenAI Latency</span>
                    <span className="font-bold">242ms</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
