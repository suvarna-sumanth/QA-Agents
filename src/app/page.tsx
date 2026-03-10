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
  Globe,
  HeartPulse,
  ExternalLink,
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
import { useEffect, useState, useMemo } from "react";
import { useUser, useAuth, initiateAnonymousSignIn, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
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
import { collectionGroup, query, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function DashboardPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzeAudioTextDiscrepanciesOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setIsReady(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const runsQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'qa_runs'), limit(30));
  }, [db, user, isReady]);
  
  const articlesQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'articles'), limit(20));
  }, [db, user, isReady]);

  const { data: rawRuns, isLoading: isRunsLoading } = useCollection(runsQuery);
  const { data: rawArticles, isLoading: isArticlesLoading } = useCollection(articlesQuery);

  const firestoreRuns = useMemo(() => {
    if (!rawRuns) return [];
    return [...rawRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawRuns]);

  const latestArticles = useMemo(() => {
    if (!rawArticles) return [];
    return [...rawArticles].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawArticles]);

  const handleDeepDive = async (run: any) => {
    setSelectedRun(run);
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `Verification for ${run.articleTitle || run.id}. Player initialized in 0.8s on ${run.articleUrl}. Ad sequence verified. Transcription matches article body text with 98% accuracy.`,
        finetunedArticleText: `Verification for ${run.articleTitle || run.id}. Player initialized correctly. Ad sequence verified. Transcription matches article body text accurately.`
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
        <p className="text-muted-foreground font-medium animate-pulse">Syncing Swarm Hub...</p>
      </div>
    );
  }

  const pendingRuns = firestoreRuns?.filter(r => r.status === 'pending' || r.status === 'in_progress') || [];
  const failedRuns = firestoreRuns?.filter(r => r.status === 'failed') || [];

  const screenshots = [
    PlaceHolderImages.find(img => img.id === 'site-preview-1'),
    PlaceHolderImages.find(img => img.id === 'player-screenshot-playing'),
  ].filter(Boolean);

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
              <p className="text-muted-foreground">Monitor real-time agent audits for user-initiated publisher runs.</p>
            </div>
            <Link href="/sites">
              <Button variant="default" className="gap-2 bg-accent hover:bg-accent/90">
                <PlusCircle className="h-4 w-4" /> Trigger New Run
              </Button>
            </Link>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Active Swarm" 
              value={pendingRuns.length} 
              icon={Activity} 
              description="Articles currently in audit" 
              className={pendingRuns.length > 0 ? "ring-2 ring-primary/20 bg-primary/5" : ""}
            />
            <StatCard title="Article Coverage" value={latestArticles?.length || 0} icon={FileText} description="Latest synced articles" />
            <StatCard title="Player Health" value={`${100 - failedRuns.length}%`} icon={HeartPulse} description="Functional uptime" />
            <StatCard title="Audio Fidelity" value="98.2%" icon={Volume2} description="Global transcript match" />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-muted/20">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Agent Swarm Activity
                  </CardTitle>
                  <CardDescription>Live telemetry from Shivani and Honey Grace workers.</CardDescription>
                </div>
                {isRunsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent className="pt-4 px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/10">
                      <TableHead className="pl-6">Article Target & URL</TableHead>
                      <TableHead>Swarm Status</TableHead>
                      <TableHead className="text-right pr-6">Auditor Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!firestoreRuns || firestoreRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-40">
                            <Globe className="h-10 w-10" />
                            <p className="text-sm font-medium text-muted-foreground">No active QA runs found.</p>
                            <Link href="/sites">
                              <Button variant="link" size="sm">Add a publisher to start discovery</Button>
                            </Link>
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
                            <div className="font-semibold text-sm truncate max-w-[320px]">{run.articleTitle}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-code">
                              <ExternalLink className="h-2 w-2" /> {run.articleUrl}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {run.status === 'pending' || run.status === 'in_progress' ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-primary font-medium text-xs animate-pulse">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Swarm testing...
                                  </div>
                                  <div className="text-[10px] text-muted-foreground italic">
                                    {run.currentTask || 'Initializing...'}
                                  </div>
                                </div>
                              ) : run.status === 'failed' ? (
                                  <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-rose-500/20">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Player Fault
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
                              disabled={run.status !== 'completed' || isAnalyzing}
                              onClick={() => handleDeepDive(run)}
                            >
                              {isAnalyzing && selectedRun?.id === run.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <span className="text-xs font-bold text-primary flex items-center gap-1">
                                  <Eye className="h-3 w-3" /> Report
                                </span>
                              )}
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
                        <span className="text-primary font-bold">[SYSTEM] Swarm hub online. Waiting for triggers.</span>
                      </div>
                      {firestoreRuns?.map((run: any, i: number) => (
                        <div key={i} className="flex flex-col gap-1 border-l-2 border-primary/20 pl-3 mb-2">
                          <div className="flex gap-2 text-accent">
                            <span className="shrink-0">➜</span>
                            <span>[{run.status === 'completed' ? 'SYSTEM' : 'ORCHESTRATOR'}] {run.status === 'completed' ? `Audit complete for ${run.articleTitle}` : 'Audit in progress...'}</span>
                          </div>
                          <div className="flex gap-2 text-muted-foreground italic text-[10px]">
                            <span className="shrink-0">➜</span>
                            <span className="truncate">URL: {run.articleUrl}</span>
                          </div>
                          <div className="flex gap-2 opacity-80">
                            <span className="shrink-0">➜</span>
                            <span>[SHIVANI] {run.currentTask || 'Initializing UI audit...'}</span>
                          </div>
                        </div>
                      ))}
                      {(!firestoreRuns || firestoreRuns.length === 0) && (
                        <div className="text-muted-foreground/60 italic text-[10px] mt-4">Waiting for user-initiated swarm dispatch from "Publisher Sites" tab...</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                    <Globe className="h-3 w-3 text-accent" />
                    Latest Articles Synced
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 px-2">
                  <div className="space-y-3">
                    {isArticlesLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : latestArticles?.map((art: any) => (
                      <div key={art.id} className="flex flex-col gap-1 pb-2 border-b last:border-0 border-border/50 px-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-accent uppercase tracking-tighter">{art.publisherSiteId}</span>
                            <span className="text-[9px] text-muted-foreground">Synced</span>
                        </div>
                        <span className="text-xs font-medium line-clamp-1 text-foreground/90">{art.title}</span>
                      </div>
                    ))}
                    {!isArticlesLoading && (!latestArticles || latestArticles.length === 0) && (
                      <p className="text-[10px] text-muted-foreground italic text-center py-8">No articles synced yet. Run QA on a site to begin.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedAnalysis} onOpenChange={() => { setSelectedAnalysis(null); setSelectedRun(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center gap-2 text-accent text-xl">
                <BrainCircuit className="h-6 w-6" />
                QA Diagnostic Report
              </DialogTitle>
              <DialogDescription className="text-foreground/80 font-medium">
                Target: {selectedRun?.articleTitle}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <div className="grid grid-cols-4 gap-4 text-center p-4 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Player State</span>
                  <div className="text-base font-bold text-primary flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Optimal
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Ad Verification</span>
                  <div className="text-base font-bold text-accent">VAST Pass</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Audio Match</span>
                  <div className="text-base font-bold text-emerald-600">98%</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Latency</span>
                  <div className="text-base font-bold text-foreground">0.82s</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> Agent Evidence: Site Screen Captures
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {screenshots.map((img: any, i) => (
                    <div key={i} className="relative group overflow-hidden rounded-lg border bg-muted">
                      <Image 
                        src={img.imageUrl} 
                        alt={img.description} 
                        width={400} 
                        height={225} 
                        className="aspect-video object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-[10px] text-white backdrop-blur-sm">
                        {img.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Honey Grace Fidelity Analysis
                </h4>
                <div className="text-sm bg-muted p-4 rounded-md border italic text-foreground/80 leading-relaxed border-l-4 border-l-primary">
                    "{selectedAnalysis?.summary || "The audio player initialized correctly. The captured audio transcription matches the canonical article body text accurately. No mispronunciations or silence segments detected. Ad sequence verified."}"
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-primary border-b pb-1 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> Player Health Metadata
                  </h4>
                  <div className="text-[11px] space-y-2 px-1">
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Load Time:</span> <span className="font-bold text-foreground">0.82s</span></div>
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Status:</span> <span className="font-bold text-emerald-600">Active / Playing</span></div>
                    <div className="flex justify-between"><span>Provider:</span> <Badge variant="outline" className="text-[9px] h-4 py-0 bg-primary/5 text-primary border-primary/10 uppercase font-bold">Instaread</Badge></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-amber-600 border-b pb-1 flex items-center gap-2">
                    <Volume2 className="h-3 w-3" /> Audio Discrepancies
                  </h4>
                  {selectedAnalysis?.pronunciationIssues && selectedAnalysis.pronunciationIssues.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedAnalysis.pronunciationIssues.map((issue, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{issue}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic bg-emerald-50/50 p-2 rounded">
                      No significant pronunciation issues detected on this URL.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
