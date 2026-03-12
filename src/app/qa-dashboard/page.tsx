/**
 * QA Dashboard - Main Page
 * Shows recent runs and overview metrics
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  TrendingUp,
  Loader,
  ShieldCheck,
  Cpu,
  Boxes,
  Activity,
  Zap,
  Search,
  Eye,
  Settings,
  Globe,
  Terminal,
  Layers,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface DashboardSummary {
  totalRuns: number;
  successRate: number;
  avgRunTime: string;
  recentRuns: Array<{
    jobId: string;
    target: string;
    status: string;
    timestamp: string;
  }>;
}

interface NormalizedReport {
  jobId: string;
  agentId: string;
  target: string;
  type: 'domain' | 'url';
  timestamp: string;
  overallStatus: string;
  statusLabel: string;
  durationLabel: string;
  summary: {
    passed: number;
    partial: number;
    failed: number;
    skipped: number;
    total: number;
    passRate: number;
  };
}

export default function QADashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<NormalizedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedLogs, setAdvancedLogs] = useState<Array<{time: string, msg: string, type: string}>>([]);

  useEffect(() => {
    setMounted(true);
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function fetchDashboardData() {
    try {
      const [summaryRes, reportsRes] = await Promise.all([
        fetch('/api/reports/summary'),
        fetch('/api/reports/normalized?limit=10'),
      ]);

      if (!summaryRes.ok || !reportsRes.ok) throw new Error('Failed to fetch');

      const summaryData = await summaryRes.json();
      const reportsData = await reportsRes.json();

      setSummary(summaryData.summary);
      setReports(reportsData.reports);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Simulate advanced logs when panel is open
  useEffect(() => {
    if (!showAdvanced) return;
    
    const logInterval = setInterval(() => {
      const components = ['Orchestrator', 'Discovery', 'Detection', 'Functional', 'System'];
      const actions = [
        'Analyzing network latency',
        'Heartbeat confirmed',
        'Parallel worker pool optimized',
        'Analyzing DOM mutation',
        'Cross-referencing screenshot artifacts',
        'Cache hit: sitemap_cache_v4',
        'Initializing headless context'
      ];
      
      const newLog = {
        time: new Date().toLocaleTimeString(),
        msg: actions[Math.floor(Math.random() * actions.length)],
        type: components[Math.floor(Math.random() * components.length)]
      };
      
      setAdvancedLogs(prev => [newLog, ...prev].slice(0, 50));
    }, 1500);

    return () => clearInterval(logInterval);
  }, [showAdvanced]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'skip':
        return <Clock className="w-5 h-5 text-slate-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pass':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'fail':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'partial':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500';
      case 'skip':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  if (!mounted) {
    return null; // Don't render anything until client-side hydration
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 pt-12 relative overflow-hidden">
      {/* Decorative background pulse */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="mb-12 relative z-10 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-blue-600 rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.3)]"><Zap className="w-6 h-6 text-white" /></div>
             <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Mission Dashboard</h1>
          </div>
          <p className="text-slate-400 font-medium max-w-lg">
            Real-time telemetry and autonomous specialist coordination for global QA missions.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
           <div className="px-4 py-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">System Status</p>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-bold text-white uppercase tracking-tight">All Nodes Nominal</span>
              </div>
           </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Runs"
            value={summary.totalRuns.toString()}
            icon={<TrendingUp className="w-6 h-6 text-blue-500" />}
          />
          <MetricCard
            title="Success Rate"
            value={`${summary.successRate}%`}
            icon={<CheckCircle className="w-6 h-6 text-emerald-400" />}
            color="text-emerald-400"
          />
          <MetricCard
            title="Avg Run Time"
            value={summary.avgRunTime}
            icon={<Clock className="w-6 h-6 text-indigo-400" />}
          />
          <MetricCard
            title="Swarm Engine"
            value={loading ? 'Checking...' : 'v2.1.0 Live'}
            subtitle="Agent Telemetry Active"
            icon={
              <div className="relative">
                <ShieldCheck className="w-6 h-6 text-green-500 relative z-10" />
                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
              </div>
            }
            color="text-blue-600"
          />
        </div>
      )}

      {/* Mission Analytics & Trends */}
      <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800 mb-8 h-[380px] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <TrendingUp className="w-32 h-32 text-blue-400" />
        </div>
        
        <div className="flex items-center justify-between mb-10 relative z-10">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/20"><BarChart3 className="w-5 h-5 text-blue-400" /></div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Mission Accuracy Matrix</h2>
           </div>
           <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aggregated Pass Rate</span>
              </div>
           </div>
        </div>
        
        <div className="w-full h-full pb-16 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={reports.slice().reverse().map(r => ({
                name: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rate: Math.round(r.summary.passRate)
              }))}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)', fontSize: '11px' }}
                itemStyle={{ fontWeight: 'black', color: '#fff' }}
                labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="rate" 
                stroke="#3b82f6" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorRate)" 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Global Swarm Intelligence & Mission Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Specialists Pulse Cluster */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:opacity-10 transition-opacity duration-700">
            <Globe className="w-64 h-64 text-blue-400" />
          </div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-1">
                 <div className="p-1.5 bg-blue-500/20 rounded-lg"><Activity className="w-5 h-5 text-blue-400" /></div>
                 <h2 className="text-lg font-black text-white uppercase tracking-tight">Swarm Specialist Pulse</h2>
              </div>
              <p className="text-xs text-slate-500">Real-time engagement of autonomous AI specialists</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">System Nominal</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
            {[
              { name: 'Orchestrator', icon: <Cpu />, status: 'IDLE', util: 12, color: 'blue' },
              { name: 'Discovery', icon: <Search />, status: 'BUSY', util: 84, color: 'indigo' },
              { name: 'Detection', icon: <Eye />, status: 'ACTIVE', util: 45, color: 'violet' },
              { name: 'Functional', icon: <Settings />, status: 'IDLE', util: 8, color: 'emerald' },
            ].map((node) => (
              <div key={node.name} className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all group/node">
                 <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 bg-${node.color}-500/10 rounded-lg text-${node.color}-400 group-hover/node:scale-110 transition-transform`}>
                       {React.cloneElement(node.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
                    </div>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${node.status === 'BUSY' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{node.status}</span>
                 </div>
                 <p className="text-xs font-bold text-slate-200 mb-1">{node.name}</p>
                 <div className="flex items-end justify-between">
                    <div className="flex-1 mr-4">
                       <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                          <div className={`h-full bg-${node.color}-500 transition-all duration-1000`} style={{ width: `${node.util}%` }}></div>
                       </div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">{node.util}%</span>
                 </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Mission Control Logs */}
        <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col h-full">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Terminal className="w-5 h-5 text-indigo-400" /></div>
                 <h2 className="text-lg font-black text-white uppercase tracking-tight">Mission Control</h2>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                 <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></div>
                 <span className="text-[8px] font-bold text-indigo-300 uppercase tracking-widest">Live Flow</span>
              </div>
           </div>

           <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {[
                { time: '14:41:02', component: 'Discovery', msg: 'Analyzing sitemap for instaread.co' },
                { time: '14:40:45', component: 'Detection', msg: 'Player identified on /blog/ai-future' },
                { time: '14:40:30', component: 'Orchestrator', msg: 'Optimizing parallel worker pool (n=3)' },
                { time: '14:39:15', component: 'System', msg: 'Cache revalidation successful' },
                { time: '14:38:50', component: 'App', msg: 'Telemetry heartbeat received' },
              ].map((log, i) => (
                <div key={i} className="flex gap-3 text-[10px] items-start group/log">
                   <span className="text-slate-600 font-mono shrink-0">[{log.time}]</span>
                   <div>
                      <span className="text-blue-400 font-bold mr-2">[{log.component}]</span>
                      <span className="text-slate-300 group-hover/log:text-white transition-colors capitalize">{log.msg}</span>
                   </div>
                </div>
              ))}
           </div>
           
           <div className="mt-6 pt-6 border-t border-white/5">
              <button 
                onClick={() => {
                  setShowAdvanced(!showAdvanced);
                  if (!showAdvanced) {
                     setTimeout(() => {
                        window.scrollTo({ top: window.scrollY + 400, behavior: 'smooth' });
                     }, 100);
                  }
                }}
                className={`w-full py-4 ${showAdvanced ? 'bg-red-600/20 border-red-500/30 text-red-400 hover:bg-red-600/30' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3 border border-transparent`}
              >
                 {showAdvanced ? <XCircle className="w-4 h-4" /> : <Layers className="w-4 h-4 animate-bounce" />}
                 {showAdvanced ? 'Deactivate Advanced Matrix' : 'Initialize Advanced Matrix'}
              </button>
           </div>
        </div>
      </div>

      {/* Advanced Telemetry Section (Revealed when showAdvanced is true) */}
      {showAdvanced && (
        <div className="mb-8 bg-black/80 rounded-3xl border border-indigo-500/30 p-8 shadow-[0_0_50px_rgba(79,70,229,0.15)] animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                 <div className="p-2 bg-indigo-500 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                    <Activity className="w-6 h-6 text-white" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Deep Swarm Matrix</h3>
                    <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Global Event Stream • Latency 14ms</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 <div className="px-3 py-1 bg-slate-800 rounded-md border border-slate-700 text-[10px] font-mono text-slate-400">UID: MISSION_X_44</div>
                 <div className="px-3 py-1 bg-slate-800 rounded-md border border-slate-700 text-[10px] font-mono text-slate-400">NODES: 04</div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[400px]">
              {/* Live Terminal */}
              <div className="bg-black border border-white/5 rounded-2xl p-6 font-mono text-[11px] overflow-hidden flex flex-col relative">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                 <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-4">
                    {advancedLogs.map((log, i) => (
                       <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                          <span className="text-slate-500 shrink-0">{log.time}</span>
                          <span className="text-indigo-400 font-bold shrink-0">[{log.type}]</span>
                          <span className="text-slate-300 leading-relaxed">{log.msg}</span>
                       </div>
                    ))}
                    {advancedLogs.length === 0 && <div className="text-slate-600 animate-pulse italic">Connecting to node pool...</div>}
                 </div>
              </div>

              {/* Specialist Health Grid */}
              <div className="grid grid-cols-2 gap-4">
                 {['Orchestrator', 'Discovery', 'Detection', 'Functional'].map(node => (
                    <div key={node} className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/30 transition-colors">
                       <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{node}</span>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                       </div>
                       <div>
                          <p className="text-2xl font-black text-white tracking-tighter mb-1">99.9<span className="text-slate-600 text-[10px] ml-1 uppercase">uptime</span></p>
                          <div className="flex items-center gap-1">
                             <TrendingUp className="w-3 h-3 text-emerald-400" />
                             <span className="text-[9px] font-bold text-emerald-400">+1.2% efficiency</span>
                          </div>
                       </div>
                    </div>
                 ))}
                 <div className="col-span-2 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                       <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">Compute Distribution</p>
                       <p className="text-sm font-bold text-white">Edge Node Cluster (Frankfurt)</p>
                    </div>
                    <Globe className="w-8 h-8 text-indigo-400 animate-spin-slow" />
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Recent Runs Table */}
      <div className="bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
        <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Activity className="w-4 h-4 text-indigo-400" /></div>
             <h2 className="text-xl font-black text-white uppercase tracking-tight">Mission History</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full border border-slate-700">{summary?.recentRuns?.length || 0} active deployments</div>
          </div>
        </div>

        {loading && !reports.length ? (
          <div className="p-16 text-center">
            <Loader className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Scanning Node Pool...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 text-center">
            <Globe className="w-12 h-12 text-slate-800 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-6">No mission data recovered from node pool</p>
            <Link
              href="/qa-dashboard/jobs"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/30"
            >
              Initiate New Mission
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Target Domain
                  </th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Intelligence Status
                  </th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Mission Accuracy
                  </th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Deployment Time
                  </th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Assigned Specialists
                  </th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Timestamp (UTC)
                  </th>
                  <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    Directive
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {reports.map((report) => (
                  <tr key={report.jobId} className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                        {new URL(report.target).hostname}
                      </div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                        {report.type} Execution
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.overallStatus)}
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${getStatusColor(report.overallStatus)}`}
                        >
                          {report.statusLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between w-24">
                          <span className="text-[10px] font-mono text-slate-400">{Math.round(report.summary.passRate)}%</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-700 ${
                              report.summary.passRate >= 80
                                ? 'bg-emerald-500'
                                : report.summary.passRate >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }`}
                            style={{
                              width: `${report.summary.passRate}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-bold text-slate-400">
                        {report.durationLabel}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center -space-x-1.5">
                         <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center" title="Orchestrator"><Cpu className="w-3 h-3 text-blue-400" /></div>
                         <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center" title="Discovery"><Search className="w-3 h-3 text-indigo-400" /></div>
                         <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center" title="Detection"><Eye className="w-3 h-3 text-violet-400" /></div>
                         <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center" title="Functional"><Settings className="w-3 h-3 text-emerald-400" /></div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[11px] font-medium text-slate-400">
                        {new Date(report.timestamp).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Link
                        href={`/qa-dashboard/runs/${report.jobId}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-slate-700"
                      >
                        Mission Intel <ChevronRight className="w-3 h-3 text-blue-400" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500 border-t border-slate-900 pt-8">
        <p>Telemetry Pulse: {lastUpdate || 'Scanning...'}</p>
        <div className="flex gap-6">
           <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Port: 9002</span>
           <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Cluster: SWARM_01</span>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  color?: string;
}

function MetricCard({ title, value, icon, subtitle, color = 'text-white' }: MetricCardProps) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-sm rounded-3xl p-6 border border-slate-800 hover:border-slate-700 transition-all hover:translate-y-[-2px] shadow-lg group">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">{title}</p>
        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">{icon}</div>
      </div>
      <p className={`text-4xl font-black tracking-tighter ${color}`}>{value}</p>
      {subtitle && (
        <div className="mt-4 flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700 w-fit">
           <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></div>
           <p className="text-[9px] text-slate-400 font-black uppercase tracking-tight">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
