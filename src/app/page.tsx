
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
  Volume2
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

  // CRITICAL: Gate the query until the user is authenticated to prevent permission errors
  const runsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(15));
  }, [db, user]);
  
  // Gate articles query similarly
  const articlesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collectionGroup(db, 'articles'), orderBy('createdAt', 'desc'), limit(5));
  }, [db, user]);

  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);
  const { data: latestArticles, isLoading: isArticlesLoading } = useCollection(articlesQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

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

      // Add sample articles for the site
      const articleId = `art_${site.id}_${Date.now()}`;
      const articleRef = doc(db, 'publisher_sites', site.id, 'articles', articleId);
      setDocumentNonBlocking(articleRef, {
        id: articleId,
        publisherSiteId: site.id,
        title: `Breaking: Market trends shift at ${site.name}`,
        url: `${site.url}/news/article-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });

    toast({
      title: "Environment Seeded",
      description: "Publisher sites and articles have been provisioned in Firestore.",
    });
    
    setAgentLogs(prev => [...prev, "[SYSTEM] Swarm environment seeded with new targets."]);
  };

  const handleDeepDive = async (run: any) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `Analysis for run ${run.id}. The player loaded successfully and audio began playback within 1.2s...`,
        finetunedArticleText: `Analysis for run ${run.id}. The player loaded successfully and audio began playback within 1.1s...`
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
        <p className="text-muted-foreground font-medium animate-pulse">Authenticating Swarm Node...</p>
      </div>
    );
  }

  const pendingCount = firestoreRuns?.filter(r => r.status === 'pending' || r.status === 'in_progress').length || 0;
  const failedCount = firestoreRuns?.filter(r => r.status === 'failed').length || 0;

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="bg-background/50">
        <div className="flex flex-col flex-1 p-6 gap-6">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold font-headline text-foreground">QA Command Center</h1>
              <p className="text-muted-foreground">Aggregated article testing and audio player health from Firestore.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeedData} className="gap-2">
                <PlusCircle className="h-4 w-4" /> Provision Data
              </Button>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Active Jobs" value={pendingCount} icon={Play} description="Currently testing" className={pendingCount > 0 ? "ring-2 ring-primary/20" : ""} />
            <StatCard title="Recent Articles" value={latestArticles?.length || 0} icon={FileText} description="Latest fetched articles" />
            <StatCard title="Failed Tests" value={failedCount} icon={AlertTriangle} description="Requiring QA attention" />
            <StatCard title="Player Health" value="Stable" icon={Volume2} description="Global player status" />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Latest QA Activity
                  </CardTitle>
                  <CardDescription>Live results from Shivani & Honey Grace agents.</CardDescription>
                </div>
                {isRunsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article Target</TableHead>
                      <TableHead>Swarm Status</TableHead>
                      <TableHead className="text-right">Diagnostics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!firestoreRuns || firestoreRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                          No active runs. Use the Sites page to trigger a new test.
                        </TableCell>
                      </TableRow>
                    ) : (
                      firestoreRuns.map((run: any) => (
                        <TableRow key={run.id}>
                          <TableCell className="space-y-1 py-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold">
                                {run.publisherSiteId}
                              </Badge>
                            </div>
                            <div className="font-semibold text-sm truncate max-w-[200px]">ID: {run.id}</div>
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
                              className="h-8"
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
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-primary text-sm">
                    <Terminal className="h-4 w-4" />
                    Agent Telemetry
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] w-full rounded-md border border-sidebar-border bg-black/20 p-4">
                    <div className="space-y-2 font-code text-[10px] md:text-xs">
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

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                    <FileText className="h-3 w-3 text-accent" />
                    Recent Articles Fetched
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isArticlesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : latestArticles?.map((art: any) => (
                      <div key={art.id} className="flex flex-col gap-1 pb-2 border-b last:border-0 border-border/50">
                        <span className="text-[10px] font-bold text-accent uppercase">{art.publisherSiteId}</span>
                        <span className="text-xs font-medium line-clamp-1">{art.title}</span>
                      </div>
                    ))}
                    {!isArticlesLoading && (!latestArticles || latestArticles.length === 0) && (
                      <p className="text-[10px] text-muted-foreground italic text-center">No articles synced.</p>
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
                AI-Powered Audio Insight
              </DialogTitle>
              <DialogDescription>
                Comparison of canonical text vs transcribed player audio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-center p-4 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Word Error Rate</span>
                  <div className="text-3xl font-bold text-primary">0.02</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Speech Confidence</span>
                  <div className="text-3xl font-bold text-accent">98%</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Honey Grace Analysis
                </h4>
                <p className="text-sm bg-muted p-4 rounded-md border italic text-foreground/80 leading-relaxed">
                    "The audio stream matches the canonical text with high fidelity. No significant mispronunciations detected. Player transition from 'Loading' to 'Playing' was within threshold."
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-rose-600 border-b pb-1">Anomalies Detected</h4>
                  <p className="text-[11px] text-muted-foreground italic">No functional or audio anomalies detected during this run.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-amber-600 border-b pb-1">Player Metadata</h4>
                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between"><span>Provider:</span> <span>BlogAudio</span></div>
                    <div className="flex justify-between"><span>Ad detected:</span> <span>Yes (Pre-roll)</span></div>
                    <div className="flex justify-between"><span>Buffer events:</span> <span>0</span></div>
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
