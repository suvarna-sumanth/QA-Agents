
"use client";

import { 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  BarChart3,
  Loader2,
  Terminal,
  BrainCircuit,
  Search,
  Eye
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { analyzeAudioTextDiscrepancies, type AnalyzeAudioTextDiscrepanciesOutput } from "@/ai/flows/analyze-audio-text-discrepancies-flow";

// Mock data for initial state
const INITIAL_RUNS = [
  { id: 'run-1', site: 'the-hill', agent: 'Honey Grace', status: 'completed', wer: 0.02, health: 98, title: "House passes major spending bill" },
  { id: 'run-2', site: 'reuters', agent: 'Shivani', status: 'completed', wer: 0.05, health: 92, title: "Global markets rally on tech news" },
  { id: 'run-3', site: 'fortune', agent: 'Honey Grace', status: 'completed', wer: 0.03, health: 95, title: "Fortune 500: New leaders emerge" },
  { id: 'run-4', site: 'verge', agent: 'Shivani', status: 'completed', wer: 0.12, health: 85, title: "AI hardware review: The future is now" },
];

export default function DashboardPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [runs, setRuns] = useState(INITIAL_RUNS);
  const [isSimulating, setIsSimulating] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>(["[SYSTEM] Dashboard initialized. Swarm ready."]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzeAudioTextDiscrepanciesOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
          health: 0,
          title: "Processing Article..."
        };
        
        setRuns(prev => [pendingRun, ...prev].slice(0, 6));
        setIsSimulating(true);
        
        setAgentLogs(prev => [...prev, `[ORCHESTRATOR] Dispatching agents to ${randomSite}...`]);
        
        setTimeout(() => setAgentLogs(prev => [...prev, `[SHIVANI] Locating player on ${randomSite} article...`]), 1000);
        setTimeout(() => setAgentLogs(prev => [...prev, `[HONEY GRACE] Audio stream detected. Starting transcription...`]), 2500);
        setTimeout(() => setAgentLogs(prev => [...prev, `[HONEY GRACE] Analysis complete. High fidelity detected.`]), 4000);

        setTimeout(() => {
          setRuns(currentRuns => currentRuns.map(r => 
            r.id === newId 
              ? { ...r, status: 'completed', wer: 0.04, health: 96, agent: 'Honey Grace', title: "Automated verification successful" } 
              : r
          ));
          setIsSimulating(false);
          setAgentLogs(prev => [...prev, `[SYSTEM] QA Run ${newId.slice(-4)} finalized. Results synced.`]);
        }, 5000);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleDeepDive = async (run: typeof INITIAL_RUNS[0]) => {
    setIsAnalyzing(true);
    try {
      // Real call to the GenAI flow!
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: "The house representatives passed a significant spend bill on Tuesday...",
        finetunedArticleText: "The House of Representatives has passed a significant spending bill on Tuesday, aiming to avert a government shutdown..."
      });
      setSelectedAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
            <h1 className="text-3xl font-bold font-headline text-foreground">Overview</h1>
            <p className="text-muted-foreground">Monitor real-time QA automation results across your publisher ecosystem.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Sites" value="42" icon={Globe} description="Active publishers" />
            <StatCard title="Success Rate" value="94.2%" icon={CheckCircle2} trend={{ value: 1.2, isUp: true }} description="Avg. Health" />
            <StatCard title="Active Bugs" value="7" icon={AlertTriangle} trend={{ value: 3, isUp: false }} description="Requiring review" />
            <StatCard title="Agent Swarm" value={isSimulating ? "Active" : "Standby"} icon={Cpu} className={isSimulating ? "ring-2 ring-primary animate-pulse" : ""} description={isSimulating ? "Processing tasks..." : "Ready for tasking"} />
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="space-y-1">
                          <div className="font-bold capitalize">{run.site.replace('-', ' ')}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{run.title}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {run.status === 'pending' ? (
                              <Badge variant="secondary" className="animate-pulse">Analyzing...</Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            disabled={run.status === 'pending' || isAnalyzing}
                            onClick={() => handleDeepDive(run)}
                          >
                            {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                            Analysis
                          </Button>
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
                    <span className="text-muted-foreground font-medium">GenAI Active</span>
                    <span className="font-bold text-accent">Gemini 2.5 Flash</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
          <DialogContent className="max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-accent" />
                Honey Grace - GenAI Reasoning
              </DialogTitle>
              <DialogDescription>
                Detailed comparison between transcribed audio and canonical article body.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Word Error Rate</span>
                  <div className="text-2xl font-bold">{selectedAnalysis?.wordErrorRateEstimate}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Semantic Similarity</span>
                  <div className="text-2xl font-bold">{Math.round((selectedAnalysis?.semanticSimilarityScore || 0) * 100)}%</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase text-primary">AI Executive Summary</h4>
                <p className="text-sm bg-muted p-3 rounded-md italic">"{selectedAnalysis?.summary}"</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold uppercase text-rose-600">Missing Content</h4>
                  <ul className="text-xs space-y-1">
                    {selectedAnalysis?.missingContent.map((c, i) => (
                      <li key={i} className="flex gap-2"><span className="text-rose-400">•</span> {c}</li>
                    ))}
                    {selectedAnalysis?.missingContent.length === 0 && <li className="text-muted-foreground italic">None detected</li>}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold uppercase text-amber-600">Pronunciation Issues</h4>
                  <ul className="text-xs space-y-1">
                    {selectedAnalysis?.pronunciationIssues.map((c, i) => (
                      <li key={i} className="flex gap-2"><span className="text-amber-400">•</span> {c}</li>
                    ))}
                    {selectedAnalysis?.pronunciationIssues.length === 0 && <li className="text-muted-foreground italic">None detected</li>}
                  </ul>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
