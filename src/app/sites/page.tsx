
"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Play, ExternalLink, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const publishers = [
  { id: 1, name: "The Hill", domain: "thehill.com", status: "active", articlesTested: 1254, health: 98 },
  { id: 2, name: "Reuters", domain: "reuters.com", status: "active", articlesTested: 842, health: 92 },
  { id: 3, name: "Fortune", domain: "fortune.com", status: "active", articlesTested: 312, health: 95 },
  { id: 4, name: "Verge", domain: "theverge.com", status: "active", articlesTested: 45, health: 88 },
  { id: 5, name: "MarketWatch", domain: "marketwatch.com", status: "paused", articlesTested: 567, health: 96 },
];

export default function SitesPage() {
  const { toast } = useToast();

  const handleRunQA = (name: string) => {
    toast({
      title: "QA Run Triggered",
      description: `Shivani and Honey Grace agents are now testing ${name}.`,
    });
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
            {publishers.map((site) => (
              <Card key={site.id} className="border-none shadow-sm hover:ring-1 ring-primary/20 transition-all group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{site.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      {site.domain}
                      <ExternalLink className="h-3 w-3" />
                    </CardDescription>
                  </div>
                  <Badge variant={site.status === "active" ? "default" : "secondary"}>
                    {site.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm py-2 border-y border-border/50">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground font-medium">Articles Tested</span>
                      <span className="font-bold">{site.articlesTested.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground font-medium">Player Health</span>
                      <span className={site.health > 90 ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                        {site.health}%
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90" 
                      onClick={() => handleRunQA(site.name)}
                    >
                      <Play className="h-4 w-4" /> Run Full QA
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Coverage</DropdownMenuItem>
                        <DropdownMenuItem>Agent Settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600">Pause Testing</DropdownMenuItem>
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
