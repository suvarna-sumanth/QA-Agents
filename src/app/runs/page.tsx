"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PlayCircle, 
  CheckCircle2, 
  Calendar,
  ExternalLink
} from "lucide-react";
import { useUser, useAuth, initiateAnonymousSignIn } from "@/firebase";
import { useEffect } from "react";

const MOCK_RUNS = [
  {
    id: "run-1",
    site: "thehill.com",
    status: "completed",
    browser: "chromium",
    date: "Mar 10, 2:15 PM",
    playerHealth: "pass",
    audioQuality: "pass",
    passedCount: 8
  },
  {
    id: "run-2",
    site: "reuters.com",
    status: "completed",
    browser: "firefox",
    date: "Mar 10, 1:45 PM",
    playerHealth: "pass",
    audioQuality: "fail",
    passedCount: 5
  },
  {
    id: "run-3",
    site: "fortune.com",
    status: "completed",
    browser: "webkit",
    date: "Mar 10, 11:20 AM",
    playerHealth: "pass",
    audioQuality: "pass",
    passedCount: 8
  },
  {
    id: "run-4",
    site: "theverge.com",
    status: "completed",
    browser: "chromium",
    date: "Mar 9, 11:55 PM",
    playerHealth: "fail",
    audioQuality: "pass",
    passedCount: 4
  }
];

export default function RunsPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

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
              QA Run History
            </h1>
            <p className="text-muted-foreground">Comprehensive log of all automated player and audio quality tests.</p>
          </header>

          <div className="grid gap-4">
            {MOCK_RUNS.map((run) => (
              <Card key={run.id} className="border-none shadow-sm hover:bg-muted/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg capitalize">{run.site}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{run.browser}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {run.date}
                          </div>
                          <Badge variant="default" className="h-5">
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Player Health</p>
                        <p className={`font-bold ${run.playerHealth === 'pass' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {run.playerHealth}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Audio Quality</p>
                        <p className={`font-bold ${run.audioQuality === 'pass' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {run.audioQuality}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Passed</p>
                        <p className="font-bold">{run.passedCount}</p>
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
