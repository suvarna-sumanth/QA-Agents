
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
  Eye,
  FileText,
  Activity,
  Zap,
  Server
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

const ARTICLE_TITLES = [
  "House passes major spending bill to avert shutdown",
  "Global markets rally on unexpected tech sector growth",
  "New study reveals shift in consumer digital habits",
  "Fortune 500: New leadership trends for 2024",
  "The future of AI hardware: A comprehensive review",
  "Bipartisan infrastructure agreement reaches final stages",
  "Inflation data beats expectations for third month",
  "SpaceX successfully launches next-gen satellite array",
];

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
  const [swarmStats, setSwarmStats] = useState({ cpu: 12, memory: 1.2, queue: 0 });

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7 && !isSimulating) {
        const newId = `run-${Date.now()}`;
        const sites = ['the-hill', 'reuters', 'fortune', 'verge', 'marketwatch'];
        const randomSite = sites[Math.floor(Math.random() * sites.length)];
        const randomTitle = ARTICLE_TITLES[Math.floor(Math.random() * ARTICLE_TITLES.length)];
        const isFailure = Math.random() > 0.8;
        
        const pendingRun = { 
          id: newId, 
          site: randomSite, 
          agent: isFailure ? 'Shivani' : 'Honey Grace', 
          status: 'pending', 
          wer: 0, 
          health: 0,
          title: randomTitle
        };
        
        setRuns(prev => [pendingRun, ...prev].slice(0, 6));
        setIsSimulating(true);
        setSwarmStats(prev => ({ ...prev, queue: prev.queue + 1, cpu: 45 }));
        
        setAgentLogs(prev => [...prev, `[ORCHESTRATOR] Dispatching swarm to ${randomSite}...`, `[SYSTEM] Target: "${randomTitle}"`]);
        
        setTimeout(() => setAgentLogs(prev => [...prev, `[SHIVANI] Locating player on article page...`]), 1000);
        setTimeout(() => {
            if (isFailure) {
                setAgentLogs(prev => [...prev, `[SHIVANI] ERROR: Playback timeout detected (VAST 303)`]);
                setSwarmStats(prev => ({ ...prev, cpu: 15 }));
            } else {
                setAgentLogs(prev => [...prev, `[HONEY GRACE] Audio stream detected. Starting transcription...`]);
            }
        }, 2500);

        setTimeout(() => {
          setRuns(currentRuns => currentRuns.map(r => 
            r.id === newId 
              ? { 
                  ...r, 
                  status: isFailure ? 'failed' : 'completed', 
                  wer: isFailure ? 0 : 0.04, 
                  health: isFailure ? 45 : 96, 
                  agent: isFailure ? 'Shivani' : 'Honey Grace' 
                } 
              : r
          ));
          setIsSimulating(false);
          setSwarmStats(prev => ({ ...prev, queue: Math.max(0, prev.queue - 1), cpu: 12 }));
          setAgentLogs(prev => [...prev, `[SYSTEM] QA Run ${newId.slice(-4)} finalized for "${randomTitle.substring(0, 20)}..."`]);
        }, 5000);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleDeepDive = async (run: typeof INITIAL_RUNS[0]) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `The article titled "${run.title}" was processed. The house representatives passed a significant spend bill on Tuesday...`,
        finetunedArticleText: `The article titled "${run.title}" was processed. The House of Representatives has passed a significant spending bill on Tuesday, aiming to avert a government shutdown...`
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
            <StatCard title="Active Bugs" value={runs.filter(r => r.status === 'failed').length + 4} icon={AlertTriangle} trend={{ value: 3, isUp: false }} description="Requiring review" />
            <StatCard title="Agent Swarm" value={isSimulating ? "Busy" : "Idle"} icon={Cpu} className={isSimulating ? "ring-2 ring-primary animate-pulse" : ""} description={isSimulating ? "Processing task..." : "Waiting for queue"} />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Live QA Activity
                  </CardTitle>
                  <CardDescription>Recent results from Shivani and Honey Grace agents.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                    {isSimulating ? "1 Run Active" : "Swarm Standby"}
                </Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target Information</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="space-y-1 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{run.site.replace('-', ' ')}</span>
                          </div>
                          <div className="font-semibold text-sm line-clamp-1">{run.title}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {run.status === 'pending' ? (
                              <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">Analyzing...</Badge>
                            ) : run.status === 'failed' ? (
                                <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20">
                                    <AlertTriangle className="h-3 w-3 mr-1" /> Failed
                                </Badge>
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
                            className="h-8"
                            disabled={run.status !== 'completed' || isAnalyzing}
                            onClick={() => handleDeepDive(run)}
                          >
                            {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                            Details
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
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-primary text-sm">
                    <Terminal className="h-4 w-4" />
                    Agent Swarm Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[240px] w-full rounded-md border border-sidebar-border bg-black/20 p-4">
                    <div className="space-y-2 font-code text-[10px] md:text-xs">
                      {agentLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-emerald-500 shrink-0">➜</span>
                          <span className={log.startsWith('[SYSTEM]') ? 'text-primary' : log.includes('ERROR') ? 'text-rose-400' : 'text-sidebar-foreground/80'}>
                            {log}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-accent/5 border border-accent/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-accent">
                    <BrainCircuit className="h-3 w-3" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground font-medium uppercase">Active Workers</span>
                            <span className="font-bold">{isSimulating ? "4/18" : "0/18"}</span>
                        </div>
                        <Progress value={isSimulating ? 22 : 0} className="h-1 bg-accent/10" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div className="p-2 bg-background/50 rounded-md border border-border/50">
                            <div className="text-[9px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                <Server className="h-2 w-2" /> CPU
                            </div>
                            <div className="text-sm font-bold">{swarmStats.cpu}%</div>
                        </div>
                        <div className="p-2 bg-background/50 rounded-md border border-border/50">
                            <div className="text-[9px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                <Zap className="h-2 w-2" /> Memory
                            </div>
                            <div className="text-sm font-bold">{swarmStats.memory} GB</div>
                        </div>
                   </div>
                   <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">GenAI Engine</span>
                    <Badge variant="secondary" className="text-[9px] h-4">Gemini 2.5 Flash</Badge>
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
                Honey Grace - Analysis Result
              </DialogTitle>
              <DialogDescription>
                Detailed comparison for: {runs.find(r => r.id === selectedAnalysis?.summary)?.title || "Current Article"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-center p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Word Error Rate</span>
                  <div className="text-3xl font-bold text-primary">{selectedAnalysis?.wordErrorRateEstimate}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Semantic Similarity</span>
                  <div className="text-3xl font-bold text-accent">{Math.round((selectedAnalysis?.semanticSimilarityScore || 0) * 100)}%</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <Activity className="h-3 w-3" /> AI Reasoning
                </h4>
                <p className="text-sm bg-muted p-4 rounded-md border border-border italic text-foreground/80 leading-relaxed">
                    "{selectedAnalysis?.summary}"
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-rose-600 border-b pb-1">Missing in Audio</h4>
                  <ul className="text-[11px] space-y-2">
                    {selectedAnalysis?.missingContent.map((c, i) => (
                      <li key={i} className="flex gap-2 leading-tight">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                    {selectedAnalysis?.missingContent.length === 0 && <li className="text-muted-foreground italic">No gaps detected.</li>}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-amber-600 border-b pb-1">Phonetic Anomalies</h4>
                  <ul className="text-[11px] space-y-2">
                    {selectedAnalysis?.pronunciationIssues.map((c, i) => (
                      <li key={i} className="flex gap-2 leading-tight">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                    {selectedAnalysis?.pronunciationIssues.length === 0 && <li className="text-muted-foreground italic">Perfect pronunciation.</li>}
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
