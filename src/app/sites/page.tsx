"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Play, ExternalLink, MoreVertical, Loader2, FileText, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { useState } from "react";
import { discoverArticles } from "@/ai/flows/discover-articles-flow";

export default function SitesPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [running, setRunning] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newSite, setNewSite] = useState({ name: "", url: "" });

  const sitesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'publisher_sites'), orderBy('name', 'asc'));
  }, [db]);
  const { data: firestoreSites, isLoading: isSitesLoading } = useCollection(sitesQuery);

  const handleAddSite = () => {
    if (!user || !db || !newSite.name || !newSite.url) return;

    const siteId = newSite.name.toLowerCase().replace(/\s+/g, '-');
    const siteRef = doc(db, 'publisher_sites', siteId);

    setDocumentNonBlocking(siteRef, {
      id: siteId,
      name: newSite.name,
      url: newSite.url,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    toast({ title: "Publisher Added", description: `${newSite.name} is now registered.` });
    setNewSite({ name: "", url: "" });
    setIsAdding(false);
  };

  const simulateAuditProgress = (siteId: string, runId: string) => {
    const tasks = [
      "Verifying initial loading state and DOM injection...",
      "Searching for #instaread-player container...",
      "Verifying headline: 'Listen to audio version'...",
      "Checking 'Sponsored By' ad slot visibility...",
      "Triggering playback & verifying waveform transition...",
      "Capturing frame for VAST/VMAP ad event verification...",
      "Testing replay state and user interaction reset...",
      "Finalizing Instaread ecosystem health report..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < tasks.length) {
        const runRef = doc(db, 'publisher_sites', siteId, 'qa_runs', runId);
        updateDocumentNonBlocking(runRef, {
          currentTask: tasks[currentStep],
          updatedAt: new Date().toISOString()
        });
        currentStep++;
      } else {
        clearInterval(interval);
        const runRef = doc(db, 'publisher_sites', siteId, 'qa_runs', runId);
        updateDocumentNonBlocking(runRef, {
          status: 'completed',
          currentTask: 'Audit complete.',
          overallPlayerHealthStatus: 'pass',
          overallAudioQualityStatus: 'pass',
          updatedAt: new Date().toISOString()
        });
      }
    }, 4000); 
  };

  const handleRunQA = async (siteId: string, siteName: string, siteUrl: string) => {
    if (!user || !db) return;

    setRunning(siteId);
    toast({ title: "Initializing Agents", description: `Orchestrator is identifying targets for ${siteName}...` });

    try {
      const discovery = await discoverArticles({ url: siteUrl, siteName: siteName });
      
      for (const article of discovery.articles) {
        const articleId = `art_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const articleRef = doc(db, 'publisher_sites', siteId, 'articles', articleId);
        
        setDocumentNonBlocking(articleRef, {
          id: articleId,
          publisherSiteId: siteId,
          title: article.title,
          url: article.url,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        const runId = `run_${articleId}`;
        const runRef = doc(db, 'publisher_sites', siteId, 'qa_runs', runId);
        
        setDocumentNonBlocking(runRef, {
          id: runId,
          publisherSiteId: siteId,
          articleId: articleId,
          articleTitle: article.title,
          articleUrl: article.url,
          initiatedByUserId: user.uid,
          status: 'pending',
          currentTask: 'Verifying initial loading state...',
          browserType: 'chromium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        simulateAuditProgress(siteId, runId);
      }

      toast({ 
        title: "QA Swarm Dispatched", 
        description: `Successfully discovered ${discovery.articles.length} articles. Agents are now auditing ${siteName}.` 
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Discovery Failed", description: "Failed to fetch articles for this domain." });
    } finally {
      setRunning(null);
    }
  };

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold font-headline text-foreground">Publisher Sites</h1>
              <p className="text-muted-foreground">Add new domains and trigger user-initiated QA audits for Instaread players.</p>
            </div>
            
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add Publisher
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Publisher</DialogTitle>
                  <DialogDescription>
                    Enter the domain details to begin monitoring audio player health.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Publisher Name</label>
                    <Input 
                      placeholder="e.g. Eat This, Not That!" 
                      value={newSite.name}
                      onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Base Domain URL</label>
                    <Input 
                      placeholder="https://eatthis.com" 
                      value={newSite.url}
                      onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button onClick={handleAddSite} disabled={!newSite.name || !newSite.url}>Save Publisher</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </header>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search publishers..." className="pl-9" />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {isSitesLoading && (
              <div className="col-span-full h-32 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {!isSitesLoading && firestoreSites?.length === 0 && (
              <div className="col-span-full h-48 text-center text-muted-foreground border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-muted/20">
                <Globe className="h-10 w-10 mb-2 opacity-20" />
                <p className="font-medium text-foreground">No publisher sites configured.</p>
                <p className="text-sm mb-4">Add your first domain to begin automated article discovery.</p>
                <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>Add Domain</Button>
              </div>
            )}

            {firestoreSites?.map((site: any) => (
              <Card key={site.id} className="border-none shadow-sm hover:ring-1 ring-primary/20 transition-all group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{site.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      {site.url}
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
                      <div className="flex items-center gap-1 text-primary">
                        <FileText className="h-3 w-3" /> Latest Coverage
                      </div>
                      <span className="text-foreground">Managed in Firestore</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90" 
                      onClick={() => handleRunQA(site.id, site.name, site.url)}
                      disabled={running === site.id}
                    >
                      {running === site.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run Swarm QA
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Discoveries</DropdownMenuItem>
                        <DropdownMenuItem>Edit Settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600">Delete Site</DropdownMenuItem>
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
