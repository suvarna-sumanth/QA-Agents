
"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Bug, 
  Terminal, 
  Network, 
  Eye, 
  ChevronRight, 
  Calendar,
  Layers,
  Monitor
} from "lucide-react";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const bugs = [
  {
    id: "BUG-1024",
    site: "reuters.com",
    title: "Audio Playback Timeout after Ad completion",
    severity: "critical",
    agent: "Shivani Worker (Playback)",
    date: "2024-05-20 14:32",
    step: "verify_audio_playback",
    browser: "Chrome 125.0",
    url: "https://reuters.com/business/finance/global-markets-2024-05-20"
  },
  {
    id: "BUG-1025",
    site: "thehill.com",
    title: "Mismatched Pronunciation for 'Bipartisan'",
    severity: "major",
    agent: "Honey Grace Worker (Pronunciation)",
    date: "2024-05-20 13:15",
    step: "pronunciation_detection",
    browser: "N/A (Audio QA)",
    url: "https://thehill.com/news/house-passes-bill"
  },
  {
    id: "BUG-1026",
    site: "theverge.com",
    title: "UI Overlap on Mobile viewport",
    severity: "minor",
    agent: "Shivani Worker (UI Validation)",
    date: "2024-05-19 23:45",
    step: "check_player_state",
    browser: "Mobile Safari",
    url: "https://theverge.com/2024/ai-hardware-review"
  }
];

export default function BugsPage() {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <Bug className="h-8 w-8 text-rose-600" />
              Bug Reports
            </h1>
            <p className="text-muted-foreground">Automated findings from agent swarms requiring manual review.</p>
          </header>

          <div className="space-y-4">
            {bugs.map((bug) => (
              <Card key={bug.id} className="border-none shadow-sm">
                <Accordion type="single" collapsible>
                  <AccordionItem value={bug.id} className="border-none">
                    <div className="flex items-center px-6 py-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-muted-foreground tracking-widest">{bug.id}</span>
                          <span className="font-bold text-lg">{bug.site}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{bug.title}</span>
                          <span className="text-xs text-muted-foreground">{bug.agent}</span>
                        </div>
                        <div>
                          <Badge 
                            variant={bug.severity === "critical" ? "destructive" : bug.severity === "major" ? "default" : "secondary"}
                            className="uppercase"
                          >
                            {bug.severity}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {bug.date}
                        </div>
                      </div>
                      <AccordionTrigger className="hover:no-underline py-0 ml-4" />
                    </div>
                    <AccordionContent className="px-6 pb-6 pt-2">
                      <div className="grid md:grid-cols-2 gap-6 border-t border-border/50 pt-6">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Contextual Data</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Failed Step:</span>
                              <code className="text-xs bg-muted px-1 rounded">{bug.step}</code>
                            </div>
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Browser:</span>
                              <span>{bug.browser}</span>
                            </div>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-md space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                              <Eye className="h-3 w-3" /> Artifacts Detected
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="h-8 gap-2">
                                <Terminal className="h-3 w-3" /> View Logs
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 gap-2">
                                <Network className="h-3 w-3" /> Network Trace
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 gap-2">
                                <Monitor className="h-3 w-3" /> Screenshots
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Target URL</h4>
                          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-md">
                            <span className="text-xs font-code truncate flex-1">{bug.url}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(bug.url, '_blank')}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1">Assign to Dev</Button>
                            <Button variant="secondary" className="flex-1">Mark as Fixed</Button>
                            <Button variant="outline" className="flex-1">Rerun Test</Button>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
