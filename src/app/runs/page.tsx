
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
  AlertCircle
} from "lucide-react";
import { useUser, useAuth, initiateAnonymousSignIn, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useEffect } from "react";
import { collectionGroup, query, orderBy, limit } from "firebase/firestore";

export default function RunsPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  // CRITICAL: Gate the query until the user is authenticated to prevent permission errors
  const runsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(50));
  }, [db, user]);

  const { data: firestoreRuns, isLoading: isRunsLoading } = useCollection(runsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

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
            {isRunsLoading && (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            )}

            {!isRunsLoading && firestoreRuns?.length === 0 && (
              <div className="h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground gap-2">
                <AlertCircle className="h-12 w-12 opacity-20" />
                <p>No historical runs found in the database.</p>
                <p className="text-xs">Trigger a run from the Publisher Sites page.</p>
              </div>
            )}

            {firestoreRuns?.map((run: any) => (
              <Card key={run.id} className="border-none shadow-sm hover:bg-muted/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full ${run.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : run.status === 'failed' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                        {run.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : run.status === 'failed' ? <AlertCircle className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg capitalize">{run.publisherSiteId}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{run.browserType}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {run.createdAt ? new Date(run.createdAt).toLocaleString() : 'N/A'}
                          </div>
                          <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'} className="h-5">
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Health Status</p>
                        <p className={`font-bold ${run.overallPlayerHealthStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {run.overallPlayerHealthStatus || 'pending'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Audio Quality</p>
                        <p className={`font-bold ${run.overallAudioQualityStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {run.overallAudioQualityStatus || 'pending'}
                        </p>
                      </div>
                    </div>

                    <button className="p-2 hover:bg-muted rounded-full">
                      <ExternalLink className="h-5 w-5 text-muted-foreground" />
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
