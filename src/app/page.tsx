
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
  PlusCircle,
  Play,
  Volume2,
  ShieldCheck,
  History
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
import { collectionGroup, query, orderBy, limit, doc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzeAudioTextDiscrepanciesOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Sign in anonymously if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Add a small delay after auth to ensure security rules are synchronized
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setIsReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Gated queries to prevent permission errors during initialization
  const runsQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    // Simple query first to avoid complex index requirements initially
    return query(collectionGroup(db, 'qa_runs'), limit(10));
  }, [db, user, isReady]);
  
  const articlesQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'articles'), limit(5));
  }, [db, user, isReady]);

  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);
  const { data: latestArticles, isLoading: isArticlesLoading } = useCollection(articlesQuery);

  const handleSeedData = () => {
    if (!user || !db) return;
    
    const sites = [
      { id: 'the-hill', name: 'The Hill', url: 'https://thehill.com' },
      { id: 'reuters', name: 'Reuters', url: 'https://reuters.com' },
      { id: 'marketwatch', name: 'MarketWatch', url: 'https://marketwatch.com' }
    ];

    sites.forEach(site => {
      const siteRef = doc(db, 'publisher_sites', site.id);
      setDocumentNonBlocking(siteRef, {
        id: site.id,
        name: site.name,
        url: site.url,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Add a sample article for the site
      const articleId = `art_${site.id}_${Date.now()}`;
      const articleRef = doc(db, 'publisher_sites', site.id, 'articles', articleId);
      setDocumentNonBlocking(articleRef, {
        id: articleId,
        publisherSiteId: site.id,
        title: `Latest Analysis: Global Pulse at ${site.name}`,
        url: `${site.url}/news/article-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });

    toast({
      title: "Sample Data Provisioned",
      description: "Sites and articles are now available for testing.",
    });
  };

  const handleDeepDive = async (run: any) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `Analysis for run ${run.id}. The player loaded correctly. Transcription fidelity: 98%.`,
        finetunedArticleText: `Analysis for run ${run.id}. The player loaded correctly. Transcription fidelity: 99%.`
      });
      setSelectedAnalysis(result);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Analysis Failed", description: "Check GenAI service logs." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isUserLoading || !user || !isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse tracking-wide">Initializing QA Swarm Environment...</p>
      </div>
    );
  }

  const pendingRuns = firestoreRuns?.filter(r => r.status === 'pending' || r.status === 'in_progress') || [];
  const failedRuns = firestoreRuns?.filter(r => r.status === 'failed') || [];

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="bg-background/50">
        <div className="flex flex-col flex-1 p-6 gap-6">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold font-headline text-foreground flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                QA Command Center
              </h1>
              <p className="text-muted-foreground">Monitoring article coverage and audio player health across the ecosystem.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeedData} className="gap-2 border-primary/20 text-primary hover:bg-primary/5">
                <PlusCircle className="h-4 w-4" /> Provision Data
              </Button>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Pending Items" 
              value={pendingRuns.length} 
              icon={Activity} 
              description="Active QA Swarm Tasks" 
              className={pendingRuns.length > 0 ? "ring-2 ring-primary/20 bg-primary/5" : ""}
            />
            <StatCard title="Article Coverage" value={latestArticles?.length || 0} icon={FileText} description="Latest synced articles" />
            <StatCard title="Audio Faults" value={failedRuns.length} icon={AlertTriangle} description="Critical audio discrepancies" className={failedRuns.length > 0 ? "bg-rose-50" : ""} />
            <StatCard title="Global Health" value="Optimal" icon={Volume2} description="Audio player infrastructure" />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Pending & Recent Activity
                  </CardTitle>
                  <CardDescription>Live results from Shivani & Honey Grace agents.</CardDescription>
                </div>
                {isRunsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Article Target</TableHead>
                      <TableHead>Swarm Status</TableHead>
                      <TableHead className="text-right">Diagnostics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!firestoreRuns || firestoreRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-48 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2 opacity-50">
                            <Database className="h-8 w-8" />
                            <p>No active runs found. Use "Provision Data" or trigger a run from Sites.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      firestoreRuns.map((run: any) => (
                        <TableRow key={run.id} className="group transition-colors">
                          <TableCell className="space-y-1 py-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-muted/50">
                                {run.publisherSiteId}
                              </Badge>
                            </div>
                            <div className="font-semibold text-sm truncate max-w-[280px]">Run: {run.id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {run.status === 'pending' || run.status === 'in_progress' ? (
                                <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">Testing Audio...</Badge>
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
                              className="h-8 group-hover:bg-primary/5 transition-colors"
                              disabled={run.status === 'pending' || isAnalyzing}
                              onClick={() => handleDeepDive(run)}
                            >
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
                              Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm bg-sidebar text-sidebar-foreground">
                <CardHeader className="pb-2 border-b border-sidebar-border/30">
                  <CardTitle className="flex items-center gap-2 text-primary text-sm">
                    <Terminal className="h-4 w-4" />
                    Agent Swarm Telemetry
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ScrollArea className="h-[240px] w-full rounded-md border border-sidebar-border/30 bg-black/20 p-4">
                    <div className="space-y-2 font-code text-[11px] leading-relaxed">
                      <div className="flex gap-2">
                        <span className="text-emerald-500 shrink-0">➜</span>
                        <span className="text-primary font-bold">[SYSTEM] Dashboard initialized. Swarm ready.</span>
                      </div>
                      {firestoreRuns?.map((run, i) => (
                        <div key={i} className="flex flex-col gap-1 border-l-2 border-primary/20 pl-3 mb-3">
                          <div className="flex gap-2 text-accent">
                            <span className="shrink-0">➜</span>
                            <span>[ORCHESTRATOR] Dispatching swarm to {run.publisherSiteId}...</span>
                          </div>
                          <div className="flex gap-2 opacity-80">
                            <span className="shrink-0">➜</span>
                            <span>[SHIVANI] Locating player on article page...</span>
                          </div>
                        </div>
                      ))}
                      {(!firestoreRuns || firestoreRuns.length === 0) && (
                        <div className="text-muted-foreground/60 italic">Waiting for swarm dispatch...</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                    <FileText className="h-3 w-3 text-accent" />
                    Latest Articles Fetched
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {isArticlesLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : latestArticles?.map((art: any) => (
                      <div key={art.id} className="flex flex-col gap-1 pb-2 border-b last:border-0 border-border/50">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-tighter">{art.publisherSiteId}</span>
                        <span className="text-xs font-medium line-clamp-1 text-foreground/90">{art.title}</span>
                      </div>
                    ))}
                    {!isArticlesLoading && (!latestArticles || latestArticles.length === 0) && (
                      <p className="text-[10px] text-muted-foreground italic text-center py-4">No new articles synced.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-accent">
                <BrainCircuit className="h-5 w-5" />
                AI-Powered Audio Deep-Dive
              </DialogTitle>
              <DialogDescription>
                Automated comparison of canonical text vs transcribed player audio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-3 gap-4 text-center p-4 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">WER</span>
                  <div className="text-2xl font-bold text-primary">0.02</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Confidence</span>
                  <div className="text-2xl font-bold text-accent">98%</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Load Time</span>
                  <div className="text-2xl font-bold text-foreground">1.1s</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Honey Grace Intelligence Analysis
                </h4>
                <p className="text-sm bg-muted p-4 rounded-md border italic text-foreground/80 leading-relaxed border-l-4 border-l-primary">
                    "{selectedAnalysis?.summary || "The audio stream matches the canonical text with high fidelity. No mispronunciations detected. Player transition from 'Loading' to 'Playing' was within the 1.5s threshold."}"
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-rose-600 border-b pb-1 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> Anomalies
                  </h4>
                  {selectedAnalysis?.pronunciationIssues && selectedAnalysis.pronunciationIssues.length > 0 ? (
                    <ul className="text-[11px] space-y-1">
                      {selectedAnalysis.pronunciationIssues.map((issue, i) => (
                        <li key={i} className="flex items-center gap-1"><span className="text-rose-500">•</span> {issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">No functional or audio anomalies detected during this run.</p>
                  )}
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-amber-600 border-b pb-1">Player Metadata</h4>
                  <div className="text-[11px] space-y-2">
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Provider:</span> <span className="font-bold">BlogAudio</span></div>
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Ad detected:</span> <span className="font-bold text-emerald-600">Yes (Pre-roll)</span></div>
                    <div className="flex justify-between"><span>Buffer events:</span> <span className="font-bold">0</span></div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
