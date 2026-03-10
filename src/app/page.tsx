"use client";

import { 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  Loader2,
  Terminal,
  BrainCircuit,
  FileText,
  Activity,
  Zap,
  Server,
  Database,
  PlusCircle
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
import { useUser, useAuth, initiateAnonymousSignIn, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase";
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
import { collectionGroup, query, orderBy, limit, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzeAudioTextDiscrepanciesOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>(["[SYSTEM] Dashboard initialized. Swarm ready."]);

  // Real-time Firestore query for recent runs across all sites
  const runsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(10));
  }, [db]);
  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Seeding helper to quickly populate the environment for QA engineers
  const handleSeedData = () => {
    if (!user || !db) return;
    
    const sites = [
      { id: 'the-hill', name: 'The Hill', url: 'https://thehill.com' },
      { id: 'reuters', name: 'Reuters', url: 'https://reuters.com' }
    ];

    sites.forEach(site => {
      const siteRef = doc(db, 'publisher_sites', site.id);
      setDocumentNonBlocking(siteRef, {
        ...site,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Add a dummy article
      const articleId = `art_${site.id}_1`;
      const articleRef = doc(db, 'publisher_sites', site.id, 'articles', articleId);
      setDocumentNonBlocking(articleRef, {
        id: articleId,
        publisherSiteId: site.id,
        title: `Latest news from ${site.name}`,
        url: `${site.url}/news/latest`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });

    toast({
      title: "Environment Seeded",
      description: "Sample publishers and articles have been added to Firestore.",
    });
    
    setAgentLogs(prev => [...prev, "[SYSTEM] Environment seeded with sample articles."]);
  };

  const handleDeepDive = async (run: any) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `The article titled "${run.id}" was processed. The house representatives passed a significant spend bill on Tuesday...`,
        finetunedArticleText: `The article titled "${run.id}" was processed. The House of Representatives has passed a significant spending bill on Tuesday, aiming to avert a government shutdown...`
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

  const pendingCount = firestoreRuns?.filter(r => r.status === 'pending').length || 0;
  const failedCount = firestoreRuns?.filter(r => r.status === 'failed').length || 0;

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="bg-background/50">
        <div className="flex flex-col flex-1 p-6 gap-6">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold font-headline text-foreground">Overview</h1>
              <p className="text-muted-foreground">Monitoring real-time Firestore activity across your publisher ecosystem.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSeedData} className="gap-2">
              <PlusCircle className="h-4 w-4" /> Seed Sample Data
            </Button>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Sites" value="Live" icon={Globe} description="Querying Firestore" />
            <StatCard title="Pending Tasks" value={pendingCount} icon={Database} description="Currently in queue" />
            <StatCard title="Active Bugs" value={failedCount} icon={AlertTriangle} description="Requiring review" />
            <StatCard title="Swarm Status" value={pendingCount > 0 ? "Busy" : "Idle"} icon={Cpu} className={pendingCount > 0 ? "ring-2 ring-primary animate-pulse" : ""} description={pendingCount > 0 ? "Agents active" : "Waiting for queue"} />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Live QA Activity
                  </CardTitle>
                  <CardDescription>Latest runs fetched directly from Firestore.</CardDescription>
                </div>
                {isRunsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                    {!firestoreRuns || firestoreRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                          No recent activity. Use "Seed Data" or "Run QA" on the Sites page.
                        </TableCell>
                      </TableRow>
                    ) : (
                      firestoreRuns.map((run: any) => (
                        <TableRow key={run.id}>
                          <TableCell className="space-y-1 py-4">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {run.publisherSiteId || "Unknown Site"}
                              </span>
                            </div>
                            <div className="font-semibold text-sm line-clamp-1">{run.id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {run.status === 'pending' || run.status === 'in_progress' ? (
                                <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">Analyzing...</Badge>
                              ) : run.status === 'failed' ? (
                                  <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-rose-500/20">
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
                              disabled={run.status === 'pending' || isAnalyzing}
                              onClick={() => handleDeepDive(run)}
                            >
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
                              Analysis
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-6">
              <Card className="border-none shadow-sm bg-sidebar text-sidebar-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-primary text-sm">
                    <Terminal className="h-4 w-4" />
                    System Logs
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
                    Database Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground font-medium uppercase">Active Threads</span>
                            <span className="font-bold">{pendingCount}</span>
                        </div>
                        <Progress value={pendingCount > 0 ? 100 : 0} className="h-1 bg-accent/10" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div className="p-2 bg-background/50 rounded-md border border-border/50">
                            <div className="text-[9px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                <Server className="h-2 w-2" /> Host
                            </div>
                            <div className="text-sm font-bold">Firestore</div>
                        </div>
                        <div className="p-2 bg-background/50 rounded-md border border-border/50">
                            <div className="text-[9px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                <Zap className="h-2 w-2" /> Auth
                            </div>
                            <div className="text-sm font-bold truncate">{user.uid.slice(0, 8)}</div>
                        </div>
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
                QA Analysis Result
              </DialogTitle>
              <DialogDescription>
                Detailed comparison generated by GenAI flows.
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
                    <Activity className="h-3 w-3" /> Executive Summary
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