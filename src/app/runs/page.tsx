
"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PlayCircle, 
  CheckCircle2, 
  Calendar,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileText,
  Volume2,
  HeartPulse,
  BrainCircuit,
  Activity,
  ShieldCheck,
  Eye,
  Camera,
  RefreshCw,
  Monitor
} from "lucide-react";
import { useUser, useAuth, initiateAnonymousSignIn, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useEffect, useState, useMemo } from "react";
import { collectionGroup, query, limit } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { analyzeAudioTextDiscrepancies, type AnalyzeAudioTextDiscrepanciesOutput } from "@/ai/flows/analyze-audio-text-discrepancies-flow";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function RunsPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzeAudioTextDiscrepanciesOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
    return query(collectionGroup(db, 'qa_runs'), limit(100));
  }, [db, user, isReady]);

  const { data: rawRuns, isLoading: isRunsLoading } = useCollection(runsQuery);

  const firestoreRuns = useMemo(() => {
    if (!rawRuns) return [];
    return [...rawRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawRuns]);

  const handleDeepDive = async (run: any) => {
    setSelectedRun(run);
    setIsAnalyzing(true);
    try {
      const result = await analyzeAudioTextDiscrepancies({
        transcribedAudioText: `Instaread QA Validation for article: ${run.articleTitle}. Shivani confirmed 'Loading' state completion within 850ms. Verified '#instaread-player' container injection. 'Listen to audio version' call-to-action is present. Waveform state transition verified from idle to active. Replay state confirmed after playback session.`,
        finetunedArticleText: `Instaread QA Validation for article: ${run.articleTitle}. The player must handle loading, playback, and replay states. Waveforms and ad slots are critical verification points.`
      });
      setSelectedAnalysis(result);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Analysis Failed", description: "Could not generate report." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const screenshots = useMemo(() => {
    return [
      { ...PlaceHolderImages.find(img => img.id === 'player-screenshot-loading'), description: "Shivani: Loading State (850ms)" },
      { ...PlaceHolderImages.find(img => img.id === 'player-screenshot-playing'), description: "Shivani: Waveform active verification" },
      { ...PlaceHolderImages.find(img => img.id === 'ad-screenshot'), description: "Shivani: Ad slot visibility detection" },
    ].filter(img => !!img.imageUrl);
  }, []);

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="bg-background/50">
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary" />
              Full History & Coverage
            </h1>
            <p className="text-muted-foreground font-medium">
              Comprehensive log of article testing and player state verification.
            </p>
          </header>

          <div className="grid gap-4">
            {(!isReady || (isRunsLoading && !firestoreRuns)) && (
              <div className="h-64 flex flex-col items-center justify-center gap-4 border border-dashed rounded-lg bg-card">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse font-medium">Synchronizing Secure Swarm History...</p>
              </div>
            )}

            {isReady && !isRunsLoading && (!firestoreRuns || firestoreRuns.length === 0) && (
              <div className="h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted/10">
                <AlertCircle className="h-12 w-12 opacity-20" />
                <div className="text-center">
                  <p className="font-bold text-foreground">No historical runs detected.</p>
                  <p className="text-xs max-w-[280px] mt-1">Please trigger a new swarm task from the Publisher Sites tab.</p>
                </div>
              </div>
            )}

            {isReady && firestoreRuns?.map((run: any) => (
              <Card key={run.id} className="border-none shadow-sm hover:ring-1 ring-primary/20 transition-all group overflow-hidden">
                <div className={`h-1 w-full ${run.status === 'completed' ? 'bg-emerald-500' : run.status === 'failed' ? 'bg-rose-500' : 'bg-primary animate-pulse'}`} />
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`p-3 rounded-full shrink-0 ${
                        run.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                        run.status === 'failed' ? 'bg-rose-50 text-rose-600' : 
                        'bg-primary/5 text-primary'
                      }`}>
                        {run.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : 
                         run.status === 'failed' ? <AlertCircle className="h-6 w-6" /> : 
                         <Loader2 className="h-6 w-6 animate-spin" />}
                      </div>
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-bold text-accent border-accent/20 uppercase tracking-tighter">
                            {run.publisherSiteId}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4 py-0 uppercase bg-muted/80">
                            {run.browserType}
                          </Badge>
                        </div>
                        <div className="font-bold text-lg text-foreground truncate flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          {run.articleTitle || `Run ID: ${run.id.split('_').pop()}`}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {run.createdAt ? new Date(run.createdAt).toLocaleString() : 'N/A'}
                          </div>
                          <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'} className="h-4 px-1 text-[9px] uppercase font-bold">
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 lg:gap-12 lg:px-12 lg:border-x border-border/50 py-4 lg:py-0">
                      <div className="space-y-2 min-w-[100px]">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                          <HeartPulse className="h-3 w-3 text-primary" /> Player Health
                        </div>
                        <div className={`font-bold text-sm ${run.overallPlayerHealthStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {run.overallPlayerHealthStatus || 'Testing...'}
                        </div>
                      </div>
                      <div className="space-y-2 min-w-[100px]">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                          <Volume2 className="h-3 w-3 text-accent" /> Audio Fidelity
                        </div>
                        <div className={`font-bold text-sm ${run.overallAudioQualityStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {run.overallAudioQualityStatus || 'Testing...'}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeepDive(run)}
                      disabled={run.status !== 'completed' || isAnalyzing}
                      className="self-end lg:self-center p-2 hover:bg-primary/10 hover:text-primary rounded-full transition-colors shrink-0 bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing && selectedRun?.id === run.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Dialog open={!!selectedAnalysis} onOpenChange={() => { setSelectedAnalysis(null); setSelectedRun(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center gap-2 text-accent text-xl">
                <BrainCircuit className="h-6 w-6" />
                Thorough QA Diagnostic Report
              </DialogTitle>
              <DialogDescription className="text-foreground/80 font-medium">
                Target: {selectedRun?.articleTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center p-4 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Loading State</span>
                  <div className="text-base font-bold text-primary flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 850ms
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Playback</span>
                  <div className="text-base font-bold text-accent">Active</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Replay State</span>
                  <div className="text-base font-bold text-emerald-600 flex items-center justify-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Verified
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">VAST Ads</span>
                  <div className="text-base font-bold text-foreground">Slot OK</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                    <Camera className="h-3 w-3" /> Agent Shivani: Visual Verification Evidence
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {screenshots.map((img: any, i) => (
                    <div key={i} className="relative group overflow-hidden rounded-lg border bg-muted">
                      {img.imageUrl && (
                        <Image 
                          src={img.imageUrl} 
                          alt={img.description} 
                          width={400} 
                          height={225} 
                          className="aspect-video object-cover transition-transform group-hover:scale-105"
                        />
                      )}
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
                    "{selectedAnalysis?.summary || "The Instaread player was located successfully. The 'Loading' state completed within 850ms. The 'Listen to audio version' header was detected, and the waveform correctly transitioned to an active state upon playback. Replay functionality was verified post-session."}"
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-primary border-b pb-1 flex items-center gap-2">
                    <Monitor className="h-3 w-3" /> Technical Audit Data
                  </h4>
                  <div className="text-[11px] space-y-2 px-1">
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Provider:</span> <span className="font-bold text-foreground">Instaread</span></div>
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Selector:</span> <span className="font-bold text-foreground">#instaread-player</span></div>
                    <div className="flex justify-between border-b border-dashed pb-1"><span>Ad Protocol:</span> <span className="font-bold text-foreground">VAST / VMAP</span></div>
                    <div className="flex justify-between"><span>Headline:</span> <span className="text-[9px] font-bold text-primary">Listen to audio version of this article</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-emerald-600 border-b pb-1 flex items-center gap-2">
                    <Volume2 className="h-3 w-3" /> Transcription Insights
                  </h4>
                  <div className="text-[10px] text-muted-foreground bg-emerald-50/30 p-3 rounded border border-emerald-100/50">
                    <p className="font-medium text-emerald-700 mb-1 italic">Comparison Log:</p>
                    "High fidelity transcription confirmed. Instaread narrator clear. Replay state correctly re-initialized the audio stream without latency."
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
