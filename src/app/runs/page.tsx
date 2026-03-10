"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PlayCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Calendar,
  ExternalLink
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collectionGroup, query, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";

export default function RunsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  const runsQuery = useMemoFirebase(() => {
    // CRITICAL: Gate the query until the user is signed in
    if (!user || !db) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(20));
  }, [db, user]);

  const { data: runs, isLoading, error } = useCollection(runsQuery);

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <PlayCircle className="h-8 w-8 text-primary" />
              QA Run History
            </h1>
            <p className="text-muted-foreground">Comprehensive log of all automated player and audio quality tests.</p>
          </header>

          <div className="grid gap-4">
            {isUserLoading || isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-sm">
                Unable to load run history. {error.message}
              </div>
            ) : runs && runs.length > 0 ? (
              runs.map((run) => (
                <Card key={run.id} className="border-none shadow-sm hover:bg-muted/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${run.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {run.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg capitalize">{run.publisherSiteId.replace('-', ' ')}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">{run.browserType}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {run.createdAt ? format(new Date(run.createdAt), 'MMM d, h:mm a') : 'N/A'}
                            </div>
                            <div className="flex items-center gap-1 capitalize">
                              <Badge variant={run.status === 'completed' ? 'default' : 'secondary'} className="h-5">
                                {run.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-8">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Player Health</p>
                          <p className={`font-bold ${run.overallPlayerHealthStatus === 'pass' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {run.overallPlayerHealthStatus || 'Pending'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Audio Quality</p>
                          <p className={`font-bold ${run.overallAudioQualityStatus === 'pass' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {run.overallAudioQualityStatus || 'Pending'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Passed</p>
                          <p className="font-bold">{run.playerTestsPassedCount + (run.audioTestsPassedCount || 0)}</p>
                        </div>
                      </div>

                      <button className="p-2 hover:bg-muted rounded-full">
                        <ExternalLink className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-dashed border-2 bg-transparent">
                <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <PlayCircle className="h-12 w-12 mb-4 opacity-20" />
                  <p>No QA runs recorded yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}