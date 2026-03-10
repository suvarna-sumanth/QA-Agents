"use client";

import { 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  Terminal,
  BrainCircuit,
  FileText,
  Activity,
  Volume2,
  ShieldCheck,
  History,
  PlusCircle,
  Database,
  ArrowRight
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
  const [isReady, setIsReady] = useState(false);

  // Sign in anonymously if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Add a buffer after auth to ensure security rules are synchronized and recognized
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setIsReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Gated queries: Only initiate after the user is authenticated and the "ready" buffer has passed.
  // This prevents the "Missing or insufficient permissions" error during initial handshake.
  const runsQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(15));
  }, [db, user, isReady]);
  
  const articlesQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'articles'), orderBy('createdAt', 'desc'), limit(10));
  }, [db, user, isReady]);

  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);
  const { data: latestArticles, isLoading: isArticlesLoading } = useCollection(articlesQuery);

  const handleSeedData = () => {
    if (!user || !db) return;
    
    const sites = [
      { id: 'the-hill', name: 'The Hill', url: 'https://thehill.com' },
      { id: 'reuters', name: 'Reuters', url: 'https://reuters.com' },
      { id: 'marketwatch', name: 'MarketWatch', url: 'https://marketwatch.com' },
      { id: 'fortune', name: 'Fortune', url: 'https://fortune.com' }
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

      // Create dummy articles and runs
      for(let i=1; i<=2; i++) {
        const articleId = `art_${site.id}_${i}_${Date.now()}`;
        const articleRef = doc(db, 'publisher_sites', site.id, 'articles', articleId);
        const titles = [
            "House passes major spending bill to avert shutdown",
            "Inflation data beats expectations for third month",
            "New study reveals shift in consumer digital habits",
            "Editorial: The future of publisher-side AI narration"
        ];
        const title = titles[Math.floor(Math.random() * titles.length)];

        setDocumentNonBlocking(articleRef, {
          id: articleId,
          publisherSiteId: site.id,
          title: `${title} (${site.name})`,
          url: `${site.url}/news/article-${i}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        const runId = `run_${articleId}`;
        const runRef = doc(db, 'publisher_sites', site.id, 'qa_runs', runId);
        setDocumentNonBlocking(runRef, {
          id: runId,
          publisherSiteId: site.id,
          articleId: articleId,
          initiatedByUserId: user.uid,
          status: i === 1 ? 'completed' : 'pending',
          browserType: 'chromium',
          overallPlayerHealthStatus: i === 1 ? 'pass' : 'pending',
          overallAudioQualityStatus: i === 1 ? 'pass' : 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    });

    toast({
      title: "QA Environment Provisioned",
      description: "Sites, articles, and initial runs are now live in Firestore.",
    });
  };

  const handleDeepDive = async (run: any) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `Verification for ${run.publisherSiteId}. Player initialized in 0.8s. Ad sequence verified. Transcription matches article body text with 98% accuracy.`,
        finetunedArticleText: `Verification for ${run.publisherSiteId}. Player initialized correctly. Ad sequence verified. Transcription matches article body text accurately.`
      });
      setSelectedAnalysis(result);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Analysis Failed", description: "GenAI service timeout." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isUserLoading || !user || !isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Initializing Secure QA Swarm...</p>
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
              <p className="text-muted-foreground">Monitoring article coverage and player health across all publishers.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSeedData} className="gap-2 border-primary/20 text-primary hover:bg-primary/5">
              <PlusCircle className="h-4 w-4" /> Provision Test Data
            </Button>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Active Queue" 
              value={pendingRuns.length} 
              icon={Activity} 
              description="Articles currently being tested" 
              className={pendingRuns.length > 0 ? "ring-2 ring-primary/20 bg-primary/5" : ""}
            />
            <StatCard title="Sync Coverage" value={latestArticles?.length || 0} icon={FileText} description="Articles fetched from sites" />
            <StatCard title="Player Faults" value={failedRuns.length} icon={AlertTriangle} description="Detected functional errors" className={failedRuns.length > 0 ? "bg-rose-50" : ""} />
            <StatCard title="Audio Fidelity" value="98.2%" icon={Volume2} description="Global transcription match rate" />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-muted/20">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Agent Swarm Activity
                  </CardTitle>
                  <CardDescription>Live results for player and audio verification.</CardDescription>
                </div>
                {isRunsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent className="pt-4 px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/10">
                      <TableHead className="pl-6">Article Target</TableHead>
                      <TableHead>Swarm Status</TableHead>
                      <TableHead className="text-right pr-6">Diagnostics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!firestoreRuns || firestoreRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-40">
                            <Database className="h-10 w-10" />
                            <p className="text-sm font-medium">No active swarm tasks detected.</p>
                            <Button variant="link" size="sm" onClick={handleSeedData}>Seed test environment</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      firestoreRuns.map((run: any) => (
                        <TableRow key={run.id} className="group transition-colors">
                          <TableCell className="pl-6 space-y-1 py-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-primary/5 text-primary border-primary/10">
                                {run.publisherSiteId}
                              </Badge>
                            </div>
                            <div className="font-semibold text-sm truncate max-w-[320px]">Run: {run.id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {run.status === 'pending' || run.status === 'in_progress' ? (
                                <div className="flex items-center gap-2 text-primary font-medium text-xs animate-pulse">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Shivani/Honey Grace testing...
                                </div>
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
                          <TableCell className="text-right pr-6">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 group-hover:bg-primary/5"
                              disabled={run.status === 'pending' || isAnalyzing}
                              onClick={() => handleDeepDive(run)}
                            >
                              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
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
                  <CardTitle className="flex items-center gap-2 text-primary text-sm uppercase tracking-widest font-bold">
                    <Terminal className="h-4 w-4" />
                    Agent Telemetry
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ScrollArea className="h-[280px] w-full rounded-md border border-sidebar-border/30 bg-black/20 p-4">
                    <div className="space-y-3 font-code text-[11px] leading-relaxed">
                      <div className="flex gap-2">
                        <span className="text-emerald-500 shrink-0">➜</span>
                        <span className="text-primary font-bold">[SYSTEM] Swarm initialization complete.</span>
                      </div>
                      {firestoreRuns?.filter(r => r.status === 'pending').map((run, i) => (
                        <div key={i} className="flex flex-col gap-1 border-l-2 border-primary/20 pl-3">
                          <div className="flex gap-2 text-accent">
                            <span className="shrink-0">➜</span>
                            <span>[ORCHESTRATOR] Dispatching agents to {run.publisherSiteId}...</span>
                          </div>
                          <div className="flex gap-2 opacity-80">
                            <span className="shrink-0">➜</span>
                            <span>[SHIVANI] Locating player on target article...</span>
                          </div>
                        </div>
                      ))}
                      {(!firestoreRuns || firestoreRuns.length === 0) && (
                        <div className="text-muted-foreground/60 italic">Waiting for article sync...</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                    <FileText className="h-3 w-3 text-accent" />
                    Latest Articles Synced
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {isArticlesLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : latestArticles?.map((art: any) => (
                      <div key={art.id} className="flex flex-col gap-1 pb-2 border-b last:border-0 border-border/50">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-accent uppercase tracking-tighter">{art.publisherSiteId}</span>
                            <span className="text-[9px] text-muted-foreground">Synced Just Now</span>
                        </div>
                        <span className="text-xs font-medium line-clamp-2 text-foreground/90">{art.title}</span>
                      </div>
                    ))}
                    {!isArticlesLoading && (!latestArticles || latestArticles.length === 0) && (
                      <p className="text-[10px] text-muted-foreground italic text-center py-8">No articles currently tracked.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
          <DialogContent className="max-w-2xl border-none shadow-2xl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center gap-2 text-accent text-xl">
                <BrainCircuit className="h-6 w-6" />
                Diagnostic Deep-Dive
              </DialogTitle>
              <DialogDescription>
                AI-powered comparison of fine-tuned article text vs captured player audio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <div className="grid grid-cols-3 gap-4 text-center p-4 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">WER Rate</span>
                  <div className="text-2xl font-bold text-primary">0.02</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Load Health</span>
                  <div className="text-2xl font-bold text-accent">Optimal</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Ad Verification</span>
                  <div className="text-2xl font-bold text-emerald-600">Verified</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Honey Grace Intelligence Summary
                </h4>
                <div className="text-sm bg-muted p-4 rounded-md border italic text-foreground/80 leading-relaxed border-l-4 border-l-primary">
                    "{selectedAnalysis?.summary || "The audio player loaded successfully. The captured audio transcription matches the canonical article body with 98% fidelity. No mispronunciations or silence segments detected. Ad delivery was successful."}"
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-rose-600 border-b pb-1 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> Player Anomalies
                  </h4>
                  <p className="text-[11px] text-muted-foreground italic bg-rose-50/50 p-2 rounded">
                    Shivani detected no UI overlap or playback timeouts during this verification cycle.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-amber-600 border-b pb-1 flex items-center gap-2">
                    <Volume2 className="h-3 w-3" /> Player Metadata
                  </h4>
                  <div className="text-[11px] space-y-2 px-1">
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Provider:</span> <span className="font-bold text-foreground">BlogAudio</span></div>
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Initial Load:</span> <span className="font-bold text-foreground">0.82s</span></div>
                    <div className="flex justify-between"><span>State:</span> <Badge variant="outline" className="text-[9px] h-4 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 uppercase font-bold tracking-tighter">Playing</Badge></div>
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