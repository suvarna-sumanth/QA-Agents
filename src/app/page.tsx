"use client";

import { 
  Users, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  BarChart3,
  Waves,
  Loader2,
  ShieldCheck
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
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useUser, 
  useAuth, 
  initiateAnonymousSignIn,
  setDocumentNonBlocking,
  updateDocumentNonBlocking
} from "@/firebase";
import { collectionGroup, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // 1. Handle Automatic Anonymous Sign-in
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // 2. Handle QA Engineer Role Provisioning (Prototype Only)
  useEffect(() => {
    async function provisionRole() {
      if (!user) return;
      
      const roleRef = doc(db, 'roles_qa_engineers', user.uid);
      try {
        const roleSnap = await getDoc(roleRef);
        if (!roleSnap.exists()) {
          setDocumentNonBlocking(roleRef, { 
            uid: user.uid, 
            role: 'qa_engineer',
            createdAt: new Date().toISOString() 
          }, { merge: true });
        }
        // For the prototype, we consider the user authorized once they have a UID
        setIsAuthorized(true);
      } catch (error) {
        // Fallback authorization for prototype
        setIsAuthorized(true);
      }
    }
    provisionRole();
  }, [user, db]);

  // 3. Query across all qa_runs collections using collectionGroup
  const runsQuery = useMemoFirebase(() => {
    if (!user || !isAuthorized) return null;
    return query(collectionGroup(db, 'qa_runs'), orderBy('createdAt', 'desc'), limit(5));
  }, [db, user, isAuthorized]);

  const { data: runs, isLoading: isDataLoading } = useCollection(runsQuery);

  // 4. Simulated Agent Effect: Automatically progress "pending" runs to "completed"
  useEffect(() => {
    if (!runs) return;

    const pendingRun = runs.find(r => r.status === 'pending');
    if (pendingRun) {
      const timer = setTimeout(() => {
        const siteId = pendingRun.publisherSiteId;
        const runId = pendingRun.id;
        const runRef = doc(db, 'publisher_sites', siteId, 'qa_runs', runId);
        
        updateDocumentNonBlocking(runRef, {
          status: 'completed',
          overallPlayerHealthStatus: 'pass',
          overallAudioQualityStatus: 'pass',
          playerTestsPassedCount: 5,
          audioTestsPassedCount: 3,
          updatedAt: new Date().toISOString(),
          endTime: new Date().toISOString()
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [runs, db]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Initializing Secure QA Session...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="bg-background/50">
        <div className="flex flex-col flex-1 p-6 gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline text-foreground">Dashboard Overview</h1>
            <p className="text-muted-foreground">Monitor your real-time QA automation results across all publisher sites.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Total Sites Tested" 
              value="42" 
              icon={Globe} 
              description="Across 12 publishers"
            />
            <StatCard 
              title="Success Rate" 
              value="94.2%" 
              icon={CheckCircle2} 
              trend={{ value: 1.2, isUp: true }}
              description="Last 24 hours"
            />
            <StatCard 
              title="Active Bugs" 
              value="7" 
              icon={AlertTriangle} 
              trend={{ value: 3, isUp: false }}
              description="2 Critical, 5 Major"
            />
            <StatCard 
              title="Agent Load" 
              value={runs?.some(r => r.status === 'pending') ? "82%" : "68%"} 
              icon={Cpu} 
              description="Dynamic allocation"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Recent QA Runs
                </CardTitle>
                <CardDescription>Live monitoring of shivani and honey grace agent swarms.</CardDescription>
              </CardHeader>
              <CardContent>
                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead>Agent Swarm</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Metrics</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs && runs.length > 0 ? (
                        runs.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium capitalize">
                              {run.publisherSiteId.replace('-', ' ')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={run.status === 'pending' ? "border-primary/20 bg-primary/5 text-primary" : "border-accent/20 bg-accent/5 text-accent"}>
                                {run.status === 'pending' ? "Shivani (Player)" : "Honey Grace (Audio)"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {run.status === 'pending' ? (
                                  <>
                                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                    <span className="text-sm">Detecting Player...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className="text-sm font-medium text-emerald-600">Completed</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {run.status === 'pending' ? (
                                <span className="text-xs text-muted-foreground italic">Processing...</span>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-bold">WER: 0.04</span>
                                  <Progress value={96} className="h-1 w-16" />
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No recent QA runs found. Go to "Publisher Sites" to trigger one.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-accent" />
                  Agent Health
                </CardTitle>
                <CardDescription>Performance of hierarchical agent swarms.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Shivani Master Agent (Player)</span>
                    <span className="text-muted-foreground">8/8 Healthy</span>
                  </div>
                  <Progress value={100} className="h-2 bg-muted" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="h-3 w-3 rounded-sm bg-emerald-500" title={`Worker ${i} OK`} />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Honey Grace Master Agent (Audio)</span>
                    <span className="text-muted-foreground">9/10 Healthy</span>
                  </div>
                  <Progress value={90} className="h-2" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <div key={i} className="h-3 w-3 rounded-sm bg-emerald-500" />
                    ))}
                    <div className="h-3 w-3 rounded-sm bg-rose-500" title="Retrying..." />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-accent/5 border border-accent/10 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-accent">Active Task</h4>
                  <p className="text-sm">
                    {runs?.some(r => r.status === 'pending') 
                      ? `Agent swarm processing run for ${runs.find(r => r.status === 'pending')?.publisherSiteId.replace('-', ' ')}.` 
                      : "Site Discovery Agent is currently idle and monitoring for new articles."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}