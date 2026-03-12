/**
 * QA Dashboard - Run Details Page
 * Shows detailed results for a specific job/run
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader, CheckCircle, XCircle, AlertCircle, Sparkles, Image as ImageIcon, Zap, Activity, Search, Eye, Settings, Cpu } from 'lucide-react';

interface NormalizedStep {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'partial';
  message: string;
  duration: number;
  durationMs: number;
  screenshotUrl?: string;
  nestedSteps?: NormalizedStep[];
}

interface NormalizedReport {
  jobId: string;
  agentId: string;
  type: 'domain' | 'url';
  target: string;
  timestamp: string;
  overallStatus: string;
  statusLabel: string;
  statusColor: string;
  duration: number;
  durationSeconds: number;
  durationLabel: string;
  summary: {
    passed: number;
    partial: number;
    failed: number;
    skipped: number;
    total: number;
    passRate: number;
  };
  steps: NormalizedStep[];
  agentName: string;
  agentVersion: string;
  capabilities: string[];
  metadata?: Record<string, any>;
  aiSummary?: string;
}

// Simple markdown renderer component
const MarkdownText = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-4">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-xl font-black text-white mt-8 mb-4 uppercase tracking-tight">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold text-slate-200">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 text-slate-400 list-disc pl-2 marker:text-primary">{line.replace('- ', '')}</li>;
        }
        
        // Handle bolding within lines
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="text-slate-400 leading-relaxed text-sm">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="text-white font-black">{part.replace(/\*\*/g, '')}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

function DetailMetricCard({ title, value, color }: { title: string; value: string; color: 'green' | 'red' | 'blue' | 'slate' }) {
  const colorMap = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    slate: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <div className={`p-6 rounded-2xl border ${colorMap[color]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{title}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}

export default function RunDetailsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const [jobId, setJobId] = useState<string>('');
  const [report, setReport] = useState<NormalizedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'visual' | 'tech'>('visual');

  useEffect(() => {
    (async () => {
      const { jobId: id } = await params;
      setJobId(id);
      await fetchRunDetails(id);
    })();
  }, []);

  async function fetchRunDetails(id: string) {
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) {
        throw new Error(res.status === 202 ? 'Job still running...' : 'Failed to fetch report');
      }
      const data = await res.json();
      setReport(data.report);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'fail': return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'partial': return <AlertCircle className="w-5 h-5 text-amber-400" />;
      default: return <AlertCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Header with Navigation */}
      <div className="max-w-7xl mx-auto mb-10">
        <Link href="/qa-dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-medium mb-6 transition">
          <ChevronLeft className="w-4 h-4" /> Dashboard Overview
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold uppercase rounded tracking-wider border border-primary/30 text-blue-400">Mission Telemetry</span>
               <span className="text-slate-400 font-mono text-xs font-bold">{jobId}</span>
            </div>
            <h1 className="text-4xl font-extrabold text-white leading-tight">Run Details</h1>
          </div>
          <div className="flex p-1 bg-card rounded-xl border border-border">
            <button onClick={() => setActiveTab('visual')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'visual' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}>Visual Report</button>
            <button onClick={() => setActiveTab('tech')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'tech' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}>Technical Logs</button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {/* Error State */}
        {error && (
          <div className={`rounded-xl p-6 mb-8 border ${
            error.includes('running')
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <p className="font-medium">{error}</p>
            {!error.includes('running') && (
              <button
                onClick={() => fetchRunDetails(jobId)}
                className="mt-4 px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition font-bold text-sm"
              >
                Retry Mission Sync
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="bg-card rounded-3xl p-32 text-center border border-border overflow-hidden relative">
            <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
            <Loader className="w-12 h-12 animate-spin mx-auto mb-6 text-primary relative z-10" />
            <p className="text-slate-400 font-bold tracking-tight relative z-10 uppercase text-xs">Synchronizing Swarm Telemetry...</p>
          </div>
        ) : report ? (
          <>
            {activeTab === 'visual' ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* Critical Findings */}
                {report.summary.failed > 0 && (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-10 mb-8 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-rose-500/20 rounded-xl">
                        <XCircle className="w-6 h-6 text-rose-400" />
                      </div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Critical Hardware/Software Anomalies</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {report.steps.filter(s => s.status === 'fail').slice(0, 4).map(step => (
                        <div key={step.id} className="bg-card/50 p-6 rounded-2xl border border-rose-500/10 backdrop-blur-md flex items-start gap-4 transition hover:bg-card/80">
                           <div className="mt-1 p-1 bg-rose-500/10 rounded"><AlertCircle className="w-4 h-4 text-rose-400" /></div>
                           <div>
                              <p className="text-[10px] font-black text-rose-400 mb-1 uppercase tracking-widest">{step.name.match(/^\[(.*?)\]/)?.[1] || 'GENERAL'}</p>
                              <p className="text-sm font-bold text-white mb-2">{step.name.split('] ').pop()}</p>
                              <p className="text-xs text-slate-200 leading-relaxed font-medium">{step.message}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-8 border-t border-rose-500/10 flex items-center justify-between text-[10px] font-black text-rose-400 uppercase tracking-widest">
                       <span>Anomaly Density: {report.summary.failed} Detected</span>
                       <span className="bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">Intervention Required</span>
                    </div>
                  </div>
                )}

                {report.aiSummary && (
                  <div className="bg-card rounded-3xl p-12 border border-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.05] pointer-events-none group-hover:opacity-10 transition-opacity duration-1000">
                      <Sparkles className="w-64 h-64 text-primary" />
                    </div>
                    <div className="flex items-center gap-3 mb-10">
                      <div className="p-3 bg-primary/10 rounded-xl border border-primary/20"><Sparkles className="w-6 h-6 text-primary" /></div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">AI Mission Debrief</h2>
                    </div>
                    <div className="relative z-10 prose prose-invert max-w-none prose-p:text-slate-400 prose-strong:text-white prose-h3:text-white">
                      <MarkdownText text={report.aiSummary} />
                    </div>
                  </div>
                )}

                {/* Metrics Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Metric Card Markup */}
                  <div className="p-6 rounded-2xl border border-border bg-card">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Success Rate</p>
                    <p className={`text-3xl font-black ${report.summary.passRate >= 80 ? 'text-emerald-400' : 'text-rose-400'}`}>{Math.round(report.summary.passRate)}%</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-border bg-card">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Checks Passed</p>
                    <p className="text-3xl font-black text-blue-400">{report.summary.passed}/{report.summary.total}</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-border bg-card">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mission Duration</p>
                    <p className="text-3xl font-black text-indigo-400">{report.durationLabel}</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-border bg-card">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Final Status</p>
                    <p className={`text-3xl font-black ${report.overallStatus === 'pass' ? 'text-emerald-400' : 'text-rose-400'}`}>{report.overallStatus === 'pass' ? 'READY' : 'HALT'}</p>
                  </div>
                </div>

                {/* Swarm Intelligence & Parallel Performance */}
                {report.metadata?.swarmActive && (
                  <div className="bg-slate-900 rounded-3xl shadow-2xl p-10 border border-slate-800 relative overflow-hidden mb-8 group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:opacity-10 transition-opacity duration-700">
                      <Zap className="w-64 h-64 text-yellow-400" />
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-yellow-400/20 rounded-lg"><Zap className="w-6 h-6 text-yellow-400" /></div>
                          <h2 className="text-xl font-black text-white uppercase tracking-tight">Swarm Intelligence Output</h2>
                        </div>
                        <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
                          Parallelized execution active across specialized autonomous agents. Aggregated mission telemetry indicates high coordination efficiency and resource optimization.
                        </p>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 min-w-[170px] transition-transform hover:scale-105">
                           <div className="flex items-center gap-2 mb-1">
                             <Activity className="w-3 h-3 text-yellow-400" />
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efficiency</p>
                           </div>
                           <p className="text-3xl font-black text-yellow-400">{Math.round(report.metadata.parallelEfficiency)}%</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 min-w-[170px] transition-transform hover:scale-105">
                           <div className="flex items-center gap-2 mb-1">
                             <Zap className="w-3 h-3 text-indigo-400" />
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Topology</p>
                           </div>
                           <p className="text-3xl font-black text-indigo-400">4 Specialists</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 min-w-[170px] transition-transform hover:scale-105">
                           <div className="flex items-center gap-2 mb-1">
                             <Activity className="w-3 h-3 text-green-400" />
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Speedup</p>
                           </div>
                           <p className="text-3xl font-black text-green-400">{report.metadata.speedupFactor || '1.0'}x</p>
                        </div>
                      </div>
                    </div>

                     {/* Swarm Network Topology Visualization */}
                     <div className="mt-10 mb-10 p-8 bg-slate-800/20 rounded-3xl border border-white/5 relative overflow-hidden h-[300px] flex items-center justify-center">
                        <div className="absolute inset-0 opacity-10">
                           <svg width="100%" height="100%" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M400 200L200 100M400 200L600 100M400 200L400 350" stroke="white" strokeWidth="2" strokeDasharray="4 4" className="animate-[pulse_3s_infinite]" />
                              <circle cx="400" cy="200" r="150" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                           </svg>
                        </div>
                        
                        <div className="relative w-full max-w-2xl flex flex-col md:flex-row items-center justify-between gap-12 z-20">
                           {/* Orchestrator Center */}
                           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                              <div className="w-20 h-20 bg-blue-500/20 rounded-full border-2 border-blue-500 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                                 <Cpu className="w-8 h-8 text-blue-400" />
                              </div>
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-center mt-3">Orchestrator</p>
                           </div>

                           {/* Specialists Satellites */}
                           <div className="flex flex-col gap-20 -translate-x-32">
                              <div className="flex flex-col items-center">
                                 <div className="w-14 h-14 bg-indigo-500/10 rounded-xl border border-indigo-500/30 flex items-center justify-center hover:bg-indigo-500/20 transition-colors">
                                    <Search className="w-5 h-5 text-indigo-400" />
                                 </div>
                                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-2">Discovery</p>
                              </div>
                           </div>

                           <div className="flex flex-col gap-20 translate-x-32">
                              <div className="flex flex-col items-center">
                                 <div className="w-14 h-14 bg-violet-500/10 rounded-xl border border-violet-500/30 flex items-center justify-center hover:bg-violet-500/20 transition-colors">
                                    <Eye className="w-5 h-5 text-violet-400" />
                                 </div>
                                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-2">Detection</p>
                              </div>
                           </div>

                           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-24">
                              <div className="flex flex-col items-center">
                                 <div className="w-14 h-14 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
                                    <Settings className="w-5 h-5 text-emerald-400" />
                                 </div>
                                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-2">Functional</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Expert Mission Log */}
                     {report.metadata?.swarmEvents && report.metadata.swarmEvents.length > 0 && (
                       <div className="mt-8 bg-black/40 rounded-2xl p-6 border border-white/5 font-mono">
                          <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                             <div className="w-2 h-2 rounded-full bg-red-500"></div>
                             <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                             <div className="w-2 h-2 rounded-full bg-green-500"></div>
                             <p className="text-[10px] text-slate-500 ml-2">swarm_mission_logs --tail</p>
                          </div>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                             {report.metadata.swarmEvents.map((event: any, idx: number) => (
                               <div key={idx} className="flex gap-3 text-[11px] group/log">
                                 <span className="text-slate-600 shrink-0">[{new Date(event.timestamp).toLocaleTimeString()}]</span>
                                 <span className="text-blue-400 shrink-0">[{event.component}]</span>
                                 <span className="text-slate-300 group-hover/log:text-white transition-colors">{event.message}</span>
                               </div>
                             ))}
                          </div>
                       </div>
                     )}
                   </div>
                 )}

                {/* Article Coverage Section */}
                <div className="bg-card rounded-3xl p-12 border border-border">
                  <div className="flex items-center gap-3 mb-12">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><CheckCircle className="w-6 h-6 text-indigo-400" /></div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Deployment Surface Scan</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from(new Set(report.steps.map(s => {
                      const match = s.name.match(/^\[(.*?)\]/);
                      return match ? match[1] : 'General';
                    }))).map((articleSlug) => {
                      const articleSteps = report.steps.filter(s => s.name.startsWith(`[${articleSlug}]`));
                      const isPassing = articleSteps.every(s => s.status !== 'fail');
                      const hasPlayer = articleSteps.some(s => !s.message.includes('No instaread-player detected'));
                      
                      return (
                        <div key={articleSlug} className={`p-8 rounded-3xl border transition-all hover:shadow-xl hover:-translate-y-1 ${isPassing ? 'bg-slate-900/40 border-slate-800' : 'bg-rose-500/5 border-rose-500/20'}`}>
                          <div className="flex items-start justify-between mb-6">
                            <h3 className="font-extrabold text-white truncate pr-4 text-xs uppercase tracking-widest">{articleSlug}</h3>
                            {isPassing ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                          </div>
                          
                          <div className="space-y-4 mb-6">
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-500">Subsystem Status</span>
                               <span className={hasPlayer ? 'text-emerald-400' : 'text-rose-400'}>{hasPlayer ? 'ONLINE' : 'OFFLINE'}</span>
                             </div>
                             <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full transition-all duration-1000 rounded-full ${isPassing ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                 style={{ width: `${(articleSteps.filter(s => s.status === 'pass').length / articleSteps.length) * 100}%` }}
                               />
                             </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                             {articleSteps.slice(0, 8).map(s => (
                               <div key={s.id} title={s.name} className={`w-3 h-3 rounded-md transition-transform hover:scale-125 ${s.status === 'pass' ? 'bg-emerald-500/40 border border-emerald-500/20' : s.status === 'fail' ? 'bg-rose-500/40 border border-rose-500/20' : 'bg-slate-700'}`}></div>
                             ))}
                             {articleSteps.length > 8 && <span className="text-[10px] text-slate-500 font-bold self-center">+{articleSteps.length - 8} MORE</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Visual Evidence Gallery */}
                <div className="bg-card rounded-3xl p-12 border border-border">
                   <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20"><ImageIcon className="w-6 h-6 text-blue-400" /></div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Optical Verification Logs</h2>
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-4 py-2 rounded-full border border-blue-400/20">{report.steps.filter(s => s.screenshotUrl).length} Captured Frames</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {report.steps
                      .filter((step, index, self) => step.screenshotUrl && self.findIndex(t => t.screenshotUrl === step.screenshotUrl) === index)
                      .map((step) => (
                      <div key={step.id} className="group overflow-hidden rounded-3xl border border-border bg-slate-900/60 transition-all hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30">
                        <div className="px-6 py-4 bg-slate-900/80 border-b border-border flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">{step.name.match(/^\[(.*?)\]/)?.[1] || 'GENERAL'}</span>
                            <span className="text-sm font-bold text-white truncate max-w-[250px]">{step.name.split('] ').pop()}</span>
                          </div>
                          <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${step.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'}`}>
                            {step.status}
                          </div>
                        </div>
                        <div className="aspect-video bg-black flex items-center justify-center relative overflow-hidden">
                          <img 
                            src={step.screenshotUrl} 
                            alt={step.name}
                            className="max-w-full max-h-full object-contain transition-transform duration-1000 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                             <button className="bg-white text-black px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transform translate-y-8 group-hover:translate-y-0 transition-all duration-500">Analyze High-Res</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {report.steps.filter(s => s.screenshotUrl).length === 0 && (
                      <div className="col-span-2 py-32 text-center border-2 border-dashed border-border rounded-3xl bg-slate-900/20">
                         <Search className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No visual telemetry recorded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
                {/* Technical Logs Table */}
                <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-2xl">
                   <div className="px-10 py-8 bg-slate-900/80 border-b border-border flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Mission Execution Feed</h2>
                      <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Real-time log aggregation</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-700 px-3 py-1 rounded-full">{report.steps.length} ops processed</span>
                  </div>
                  
                  <div className="divide-y divide-border/50">
                    {report.steps.map((step) => (
                      <div key={step.id} className="group">
                        <button
                          onClick={() => toggleStepExpanded(step.id)}
                          className={`w-full px-10 py-8 flex items-center gap-8 text-left transition-all ${expandedSteps.has(step.id) ? 'bg-primary/5' : 'hover:bg-slate-800/40'}`}
                        >
                          <div className="flex-shrink-0 transition-transform group-hover:scale-110">{getStatusIcon(step.status)}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2">
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${step.status === 'pass' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{step.status}</span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded">Delta: {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(2)}s`}</span>
                            </div>
                            <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                              {step.name}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1 line-clamp-1 italic font-medium opacity-80">
                              {step.message}
                            </p>
                          </div>
                          <div className={`transition-all duration-300 ${expandedSteps.has(step.id) ? 'rotate-180 text-primary' : 'text-slate-600'}`}>
                            <ChevronLeft className="w-6 h-6 -rotate-90" />
                          </div>
                        </button>

                        {expandedSteps.has(step.id) && (
                          <div className="px-28 pb-12 animate-in slide-in-from-top-4 duration-500">
                             {step.screenshotUrl && (
                                <div className="mb-10 rounded-3xl border border-border overflow-hidden aspect-video bg-black flex items-center justify-center shadow-2xl relative group/img cursor-zoom-in">
                                  <img src={step.screenshotUrl} alt="Step Result" className="max-w-full max-h-full object-contain transition-transform duration-1000 group-hover/img:scale-105" />
                                  <div className="absolute top-6 right-6 bg-black/60 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 opacity-0 group-hover/img:opacity-100 transition-all">Verification Artifact</div>
                                </div>
                             )}
                             
                             {step.nestedSteps && step.nestedSteps.length > 0 && (
                               <div className="space-y-4">
                                 {step.nestedSteps.map(nested => (
                                   <div key={nested.id} className="p-6 bg-slate-900/40 rounded-2xl flex items-center gap-6 text-sm border border-slate-800 transition hover:border-slate-700">
                                      <div className="bg-card p-2 rounded-lg">{getStatusIcon(nested.status)}</div>
                                      <div className="flex-1">
                                        <p className="font-bold text-white mb-1 uppercase text-[10px] tracking-widest">{nested.name}</p>
                                        <p className="text-slate-400 text-xs font-medium leading-relaxed">{nested.message}</p>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-24 text-center backdrop-blur-md">
            <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-6 animate-pulse" />
            <h2 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Sync Failure: Report Not Found</h2>
            <p className="text-slate-400 mb-10 max-w-md mx-auto">{error || 'Unable to establish link with the mission data stream.'}</p>
            <Link href="/qa-dashboard" className="inline-flex px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:shadow-primary/40 transition-all">Return to Command View</Link>
          </div>
        )}
      </div>
    </div>
  );
}
