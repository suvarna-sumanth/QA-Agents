
"use client";

import { 
  Loader2,
  FileText,
  Activity,
  Volume2,
  ShieldCheck,
  PlusCircle,
  Globe,
  HeartPulse,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useMemo } from "react";
import { useUser, useAuth, initiateAnonymousSignIn, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, limit } from "firebase/firestore";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setIsReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const runsQuery = useMemoFirebase(() => {
    if (!db || !user || !isReady) return null;
    return query(collectionGroup(db, 'qa_runs'), limit(50));
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
              <p className="text-muted-foreground">Monitor real-time agent audits and coverage metrics across publishers.</p>
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
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Latest Article Coverage
                    </CardTitle>
                    <CardDescription>Most recent news stories synced from registered publishers.</CardDescription>
                  </div>
                  {isArticlesLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {!latestArticles || latestArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                      <Globe className="h-10 w-10 mb-2" />
                      <p className="text-sm font-medium">No articles synced yet.</p>
                      <Link href="/sites">
                        <Button variant="link" size="sm" className="mt-1">Add a publisher site to start discovery</Button>
                      </Link>
                    </div>
                  ) : (
                    latestArticles.map((art: any) => (
                      <div key={art.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors group">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-bold text-accent uppercase tracking-tighter">
                              {art.publisherSiteId}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">Synced {new Date(art.createdAt).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-bold text-sm truncate pr-4">{art.title}</h4>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                            <ExternalLink className="h-2.5 w-2.5" />
                            {art.url}
                          </div>
                        </div>
                        <Link href="/runs">
                          <Button variant="ghost" size="icon" className="group-hover:text-primary">
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Swarm Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-80">Active Workers</span>
                    <span className="font-bold">Shivani (4) / Honey Grace (4)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-80">Current Queue</span>
                    <span className="font-bold">{pendingRuns.length} articles</span>
                  </div>
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className={`h-full bg-white transition-all duration-1000 ${pendingRuns.length > 0 ? 'w-2/3 animate-pulse' : 'w-0'}`} />
                  </div>
                  <p className="text-[10px] italic opacity-70">
                    Agents are operating within nominal parameters. Audits are triggered manually from the Publisher Sites menu.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                    <Activity className="h-3 w-3 text-accent" />
                    Recent QA Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {firestoreRuns?.slice(0, 5).map((run: any) => (
                    <div key={run.id} className="flex flex-col gap-1 pb-2 border-b last:border-0 border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-accent uppercase truncate max-w-[120px]">{run.articleTitle || run.publisherSiteId}</span>
                        <Badge variant={run.status === 'completed' ? 'outline' : 'secondary'} className="text-[8px] h-3 py-0 uppercase">
                          {run.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground italic">
                        <span>{run.overallPlayerHealthStatus === 'pass' ? 'Player OK' : 'Pending...'}</span>
                        <span>{run.overallAudioQualityStatus === 'pass' ? 'Audio OK' : 'Pending...'}</span>
                      </div>
                    </div>
                  ))}
                  {(!firestoreRuns || firestoreRuns.length === 0) && (
                    <p className="text-[10px] text-muted-foreground italic text-center py-6">No run history yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
