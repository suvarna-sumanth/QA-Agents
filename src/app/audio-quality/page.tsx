
"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Mic2, 
  FileText, 
  ArrowRightLeft,
  Volume2,
  AlertCircle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

const audioQualityLogs = [
  {
    id: 1,
    site: "thehill.com",
    title: "House passes major spending bill",
    wer: 0.02,
    semantic: 0.99,
    confidence: 0.98,
    issues: [],
    canonical: "The House of Representatives has passed a significant spending bill on Tuesday, aiming to avert a government shutdown...",
    transcribed: "The House of Representatives has passed a significant spending bill on Tuesday, aiming to avert a government shutdown...",
    status: "pass"
  },
  {
    id: 2,
    site: "reuters.com",
    title: "Inflation data beats expectations",
    wer: 0.15,
    semantic: 0.85,
    confidence: 0.72,
    issues: ["Mispronounced 'indices'", "Silence segment (3.2s)"],
    canonical: "Consumer price indices rose unexpectedly last month, according to the latest federal data released early this morning.",
    transcribed: "Consumer price indexes rose unexpectedly last month, [silence] according to the federal data released early this morning.",
    status: "fail"
  }
];

export default function AudioQualityPage() {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <Mic2 className="h-8 w-8 text-accent" />
              Audio Quality Intelligence
            </h1>
            <p className="text-muted-foreground">Deep analysis of AI-generated narration vs. fine-tuned article body.</p>
          </header>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Avg Word Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">0.03</div>
                <p className="text-xs text-emerald-600 mt-1">Excellent Fidelity</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Semantic Similarity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">96.8%</div>
                <p className="text-xs text-emerald-600 mt-1">Consistent Meaning</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Speech Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">0.92</div>
                <p className="text-xs text-muted-foreground mt-1">Target: &gt; 0.90</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {audioQualityLogs.map((log) => (
              <Card key={log.id} className="border-none shadow-sm overflow-hidden">
                <div className={`h-1 w-full ${log.status === 'pass' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {log.status === 'pass' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
                      {log.site}
                    </CardTitle>
                    <CardDescription className="text-base font-medium text-foreground">{log.title}</CardDescription>
                  </div>
                  <Badge variant={log.status === 'pass' ? 'outline' : 'destructive'} className="uppercase">
                    {log.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Word Error Rate</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{log.wer}</span>
                        <Progress value={(1 - log.wer) * 100} className="h-1 flex-1" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Semantic Sim.</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{Math.round(log.semantic * 100)}%</span>
                        <Progress value={log.semantic * 100} className="h-1 flex-1" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Confidence</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{log.confidence}</span>
                        <Progress value={log.confidence * 100} className="h-1 flex-1" />
                      </div>
                    </div>
                    <div className="space-y-1 flex flex-col items-end">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Issues</span>
                      <div className="flex gap-1 mt-1">
                        {log.issues.length === 0 ? (
                          <span className="text-xs text-emerald-600 font-medium">None detected</span>
                        ) : (
                          log.issues.map((issue, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] py-0">{issue}</Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase">
                        <FileText className="h-3 w-3" /> Canonical Article (Finetuned)
                      </div>
                      <ScrollArea className="h-32 p-3 bg-muted/50 rounded-md border text-sm italic">
                        {log.canonical}
                      </ScrollArea>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase">
                        <Volume2 className="h-3 w-3" /> Transcribed Audio
                      </div>
                      <ScrollArea className="h-32 p-3 bg-muted/50 rounded-md border text-sm">
                        {log.transcribed}
                      </ScrollArea>
                    </div>
                  </div>

                  {log.status === 'fail' && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-md flex gap-3 text-rose-800">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <div className="text-sm">
                        <strong>Honey Grace Analysis:</strong> Significant discrepancy in audio vs text. The narrator substituted "indexes" for "indices" and there is a suspicious silence segment halfway through.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
