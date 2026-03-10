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
  FileText
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

  // Buffer after auth to ensure security rules are synchronized
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setIsReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // CRITICAL: Gate the query until the user is authenticated AND ready to prevent permission errors
  const runsQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(50));
  }, [db, user, isReady]);

  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary" />
              Full History & Coverage
            </h1>
            <p className="text-muted-foreground">Comprehensive log of all automated player and audio quality tests.</p>
          </header>

          <div className="grid gap-4">
            {(isRunsLoading || !isReady) && (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Syncing coverage history...</p>
              </div>
            )}

            {!isRunsLoading && isReady && firestoreRuns?.length === 0 && (
              <div className="h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground gap-2 bg-muted/10">
                <AlertCircle className="h-12 w-12 opacity-20" />
                <p className="font-medium text-foreground">No historical runs detected.</p>
                <p className="text-xs">Trigger a new QA run or provision test data from the Overview dashboard.</p>
              </div>
            )}

            {isReady && firestoreRuns?.map((run: any) => (
              <Card key={run.id} className="border-none shadow-sm hover:bg-muted/30 transition-all group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-3 rounded-full shrink-0 ${run.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : run.status === 'failed' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                        {run.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : run.status === 'failed' ? <AlertCircle className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-accent uppercase tracking-tighter">{run.publisherSiteId}</span>
                          <Badge variant="outline" className="text-[10px] h-4 py-0 uppercase bg-muted/50">{run.browserType}</Badge>
                        </div>
                        <div className="font-semibold text-lg text-foreground truncate flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          {run.articleTitle || `Run ID: ${run.id.split('_').pop()}`}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {run.createdAt ? new Date(run.createdAt).toLocaleString() : 'N/A'}
                          </div>
                          <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'} className="h-4 px-1 text-[9px] uppercase">
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-8 px-6 border-x">
                      <div className="text-center w-24">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Player Health</p>
                        <p className={`font-bold text-sm ${run.overallPlayerHealthStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {run.overallPlayerHealthStatus || 'pending'}
                        </p>
                      </div>
                      <div className="text-center w-24">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Audio Fidelity</p>
                        <p className={`font-bold text-sm ${run.overallAudioQualityStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {run.overallAudioQualityStatus || 'pending'}
                        </p>
                      </div>
                    </div>

                    <button className="p-2 hover:bg-primary/10 hover:text-primary rounded-full transition-colors shrink-0">
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