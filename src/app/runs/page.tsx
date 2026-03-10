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
  Activity,
  Volume2,
  ShieldCheck,
  HeartPulse
} from "lucide-react";
import { useUser, useAuth, initiateAnonymousSignIn, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useEffect, useState } from "react";
import { collectionGroup, query, orderBy, limit } from "firebase/firestore";

export default function RunsPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isReady, setIsReady] = useState(false);

  // Sign in anonymously if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Buffer after auth to ensure security rules are synchronized across the prototype swarm
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setIsReady(true), 2000); 
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Gated query - only fire when authenticated and readiness buffer has elapsed
  const runsQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(50));
  }, [db, user, isReady]);

  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);

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
              Comprehensive log of article testing and player health verification.
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
                  <p className="text-xs max-w-[280px] mt-1">Please trigger a new swarm task or provision test data from the dashboard.</p>
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

                    <button className="self-end lg:self-center p-2 hover:bg-primary/10 hover:text-primary rounded-full transition-colors shrink-0 bg-muted/30">
                      <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
