
import { 
  Users, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu,
  BarChart3,
  Waves
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

export default function DashboardPage() {
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
              value="68%" 
              icon={Cpu} 
              description="12/18 Agents active"
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site / Article</TableHead>
                      <TableHead>Agent Swarm</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Metrics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>thehill.com</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">House passes major...</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Shivani (Player)</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-sm">Detecting Player</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">Waiting...</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>thehill.com</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">New Senate rules...</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-accent/20 bg-accent/5 text-accent">Honey Grace (Audio)</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">Completed</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold">WER: 0.04</span>
                          <Progress value={96} className="h-1 w-16" />
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>reuters.com</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">Global markets today...</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Shivani (Player)</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-rose-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Failed</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium text-rose-600">Timeout: Click Play</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
                    <span className="text-muted-foreground">7/10 Healthy</span>
                  </div>
                  <Progress value={70} className="h-2" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div key={i} className="h-3 w-3 rounded-sm bg-emerald-500" />
                    ))}
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-3 w-3 rounded-sm bg-rose-500" title="Retrying..." />
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-accent/5 border border-accent/10 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-accent">Active Task</h4>
                  <p className="text-sm">Site Discovery Agent is crawling <strong>thehill.com</strong> for new articles.</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>3 Articles Found</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
