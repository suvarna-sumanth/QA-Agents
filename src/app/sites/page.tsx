"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Play, ExternalLink, MoreVertical, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, setDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { useState } from "react";

export default function SitesPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [running, setRunning] = useState<string | null>(null);

  // Fetch real sites from Firestore
  const sitesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'publisher_sites'), orderBy('name', 'asc'));
  }, [db]);
  const { data: firestoreSites, isLoading: isSitesLoading } = useCollection(sitesQuery);

  const handleRunQA = (siteId: string, siteName: string) => {
    if (!user || !db) return;

    setRunning(siteId);
    
    const runId = `run_${Date.now()}`;
    const runRef = doc(db, 'publisher_sites', siteId, 'qa_runs', runId);

    const runData = {
      id: runId,
      publisherSiteId: siteId,
      initiatedByUserId: user.uid,
      status: 'pending',
      browserType: 'chromium',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalArticlesTested: 1,
      playerTestsPassedCount: 0,
      playerTestsFailedCount: 0,
      audioTestsPassedCount: 0,
      audioTestsFailedCount: 0,
    };

    setDocumentNonBlocking(runRef, runData, { merge: true });
    
    toast({
      title: "QA Run Initiated",
      description: `Monitoring ${siteName} for player and audio fidelity.`,
    });

    // Reset UI state after a short delay
    setTimeout(() => setRunning(null), 1000);
  };

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold font-headline">Publisher Sites</h1>
              <p className="text-muted-foreground">Manage and trigger automated QA runs for your customers.</p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Publisher
            </Button>
          </header>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search publishers..." className="pl-9" />
            </div>
            <Button variant="outline">Filter</Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {isSitesLoading && (
              <div className="col-span-full h-32 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {!isSitesLoading && firestoreSites?.length === 0 && (
              <div className="col-span-full h-32 text-center text-muted-foreground border rounded-lg flex flex-col items-center justify-center bg-muted/20">
                <p>No publisher sites found.</p>
                <p className="text-xs">Use "Seed Sample Data" on the dashboard to get started.</p>
              </div>
            )}

            {firestoreSites?.map((site: any) => (
              <Card key={site.id} className="border-none shadow-sm hover:ring-1 ring-primary/20 transition-all group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{site.name || site.domain}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      {site.url || site.domain}
                      <ExternalLink className="h-3 w-3" />
                    </CardDescription>
                  </div>
                  <Badge variant={site.isActive ? "default" : "secondary"}>
                    {site.isActive ? "active" : "paused"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Articles
                      </div>
                      <span className="text-foreground">Managed in Firestore</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90" 
                      onClick={() => handleRunQA(site.id, site.name || site.domain)}
                      disabled={running === site.id}
                    >
                      {running === site.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run Full QA
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Latest Articles</DropdownMenuItem>
                        <DropdownMenuItem>Agent Settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600">Deactivate Site</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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