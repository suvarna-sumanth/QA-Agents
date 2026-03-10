
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
  ChevronRight,
  Zap,
  LayoutDashboard
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
      const timer = setTimeout(() => setIsReady(true), 1000);
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
        <p className="text-muted-foreground font-medium animate-pulse tracking-tight">Synchronizing Command Center...</p>
      </div>
    );
  }

  const activeRuns = firestoreRuns?.filter(r => r.status === 'pending' || r.status === 'in_progress') || [];
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
              title="Active Audits" 
              value={activeRuns.length} 
              icon={Activity} 
              description="Live agent tasks" 
              className={activeRuns.length > 0 ? "ring-2 ring-primary/20 bg-primary/5" : ""}
            />
            <StatCard title="Articles Synced" value={latestArticles?.length || 0} icon={FileText} description="Total discovered" />
            <StatCard title="Global Health" value={`${firestoreRuns.length > 0 ? 100 - failedRuns.length : 100}%`} icon={HeartPulse} description="Functional uptime" />
            <StatCard title="Fidelity Avg" value="98.2%" icon={Volume2} description="Global transcription" />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                      <Zap className="h-5 w-5" />
                      Live Swarm Activity
                    </CardTitle>
                    <CardDescription>Real-time tasks being performed by Shivani and Honey Grace.</CardDescription>
                  </div>
                  {isRunsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-1">
                <div className="space-y-4">
                  {!firestoreRuns || firestoreRuns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                      <LayoutDashboard className="h-10 w-10 mb-2" />
                      <p className="text-sm font-medium">No active tasks found.</p>
                      <Link href="/sites">
                        <Button variant="link" size="sm" className="mt-1">Add a site to start auditing</Button>
                      </Link>
                    </div>
                  ) : (
                    firestoreRuns.slice(0, 8).map((run: any) => (
                      <div key={run.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors group">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={run.status === 'completed' ? 'outline' : 'default'} className="text-[10px] font-bold uppercase tracking-tighter">
                              {run.status === 'completed' ? 'Verified' : 'In Progress'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-code truncate">{run.articleUrl}</span>
                          </div>
                          <h4 className="font-bold text-sm truncate pr-4">{run.articleTitle || "Loading article..."}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-accent font-medium">
                            <Activity className={`h-2.5 w-2.5 ${run.status !== 'completed' ? 'animate-pulse' : ''}`} />
                            {run.currentTask}
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
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                    <FileText className="h-3 w-3 text-accent" />
                    Latest Synced Articles
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {latestArticles?.slice(0, 6).map((art: any) => (
                    <div key={art.id} className="flex flex-col gap-1 pb-3 border-b last:border-0 border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-primary uppercase truncate max-w-[150px]">{art.title}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(art.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate italic">
                        {art.url}
                      </div>
                    </div>
                  ))}
                  {(!latestArticles || latestArticles.length === 0) && (
                    <p className="text-[10px] text-muted-foreground italic text-center py-6">Waiting for article discovery...</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Agent Footprint
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-80">Worker Swarm</span>
                    <span className="font-bold">Active (8)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-80">Queue Depth</span>
                    <span className="font-bold">{activeRuns.length}</span>
                  </div>
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className={`h-full bg-white transition-all duration-1000 ${activeRuns.length > 0 ? 'w-full animate-pulse' : 'w-0'}`} />
                  </div>
                  <p className="text-[10px] italic opacity-70">
                    Audits are triggered manually. The swarm is standing by for new article discovery tasks.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
