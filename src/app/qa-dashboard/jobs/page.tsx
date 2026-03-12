/**
 * QA Dashboard - Job Submission Page
 * Allows users to submit new QA test jobs
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader, CheckCircle, AlertCircle, Zap, Globe, Activity, Layers } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
}

export default function JobSubmissionPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    agentId: '',
    type: 'url' as 'url' | 'domain',
    target: '',
    maxArticles: '10',
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.agents);
      if (data.agents.length > 0) {
        setFormData((prev) => ({ ...prev, agentId: data.agents[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setAgentsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!formData.agentId || !formData.target) {
        throw new Error('Please fill in all required fields');
      }

      const payload: Record<string, any> = {
        agentId: formData.agentId,
        type: formData.type,
        target: formData.target,
        config: {},
      };

      if (formData.type === 'domain') {
        payload.config.maxArticles = parseInt(formData.maxArticles, 10);
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit job');
      }

      const data = await res.json();
      setJobId(data.jobId);
      setSubmitted(true);
      setFormData({ agentId: formData.agentId, type: 'url', target: '', maxArticles: '10' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 pt-12 relative overflow-hidden">
      {/* Decorative background pulse */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="mb-12 relative z-10 font-sans">
        <Link
          href="/qa-dashboard"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest text-[10px] mb-6 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Abort to Dashboard
        </Link>
        <div className="flex items-center gap-4 mb-3">
           <div className="p-2 bg-indigo-600 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.3)]"><Zap className="w-6 h-6 text-white" /></div>
           <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Initialize Mission</h1>
        </div>
        <p className="text-slate-400 font-medium max-w-lg">
           Configure mission parameters and deploy autonomous specialists to the target vector.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        {submitted ? (
          // Success State
          <div className="bg-slate-900 rounded-3xl shadow-2xl p-10 border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/50 to-transparent"></div>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-500/10 rounded-full border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                 <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Mission Deployed!</h2>
              <p className="text-slate-400 font-medium capitalize">
                Vector acquisition successful. Job ID registered in swarm network.
              </p>
            </div>

            <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-white/5 backdrop-blur-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Mission Signature (Job ID)</p>
              <div className="flex items-center justify-between gap-4">
                 <p className="font-mono text-xs break-all font-bold text-blue-400">
                    {jobId}
                 </p>
                 <button
                    onClick={() => {
                      navigator.clipboard.writeText(jobId!);
                      alert('Signature copied to uplink.');
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors shrink-0"
                    title="Copy to clipboard"
                 >
                    <Layers className="w-4 h-4" />
                 </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Link
                href={`/qa-dashboard/runs/${jobId}`}
                className="block w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 text-center font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
              >
                Launch Telemetry Feed
              </Link>
              <div className="grid grid-cols-2 gap-4">
                 <button
                    onClick={() => {
                      setSubmitted(false);
                      setJobId(null);
                    }}
                    className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold text-[10px] uppercase tracking-widest transition-all border border-slate-700"
                 >
                    New Mission
                 </button>
                 <Link
                    href="/qa-dashboard"
                    className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 flex items-center justify-center font-bold text-[10px] uppercase tracking-widest transition-all border border-slate-700"
                 >
                    The Matrix
                 </Link>
              </div>
            </div>
          </div>
        ) : (
          // Form
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-slate-800 relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-xs font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Agent Selection */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                  Autonomous Specialist Matrix *
                </label>
                {agentsLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold italic">
                    <Loader className="w-4 h-4 animate-spin" />
                    Connecting to registry...
                  </div>
                ) : agents.length === 0 ? (
                  <div className="text-red-400 text-xs font-bold uppercase">Critical Error: Agent Missing</div>
                ) : (
                  <select
                    value={formData.agentId}
                    onChange={(e) =>
                      setFormData({ ...formData, agentId: e.target.value })
                    }
                    className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm"
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id} className="bg-slate-900">
                        {agent.name} (v{agent.version})
                      </option>
                    ))}
                  </select>
                )}
                {formData.agentId && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {agents.find((a) => a.id === formData.agentId)?.capabilities?.map(cap => (
                       <span key={cap} className="px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded-md text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {cap}
                       </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Type */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                  Target Vector Strategy *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.type === 'url' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                    <input
                      type="radio"
                      value="url"
                      checked={formData.type === 'url'}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as 'url' | 'domain' })
                      }
                      className="hidden"
                    />
                    <Zap className={`w-4 h-4 ${formData.type === 'url' ? 'text-blue-400' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Single URL</span>
                  </label>
                  <label className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.type === 'domain' ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                    <input
                      type="radio"
                      value="domain"
                      checked={formData.type === 'domain'}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as 'url' | 'domain' })
                      }
                      className="hidden"
                    />
                    <Globe className={`w-4 h-4 ${formData.type === 'domain' ? 'text-indigo-400' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Domain Crawl</span>
                  </label>
                </div>
              </div>

              {/* Target */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                  {formData.type === 'url' ? 'Target Entrypoint' : 'Domain Territory'} *
                </label>
                <input
                  type="text"
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  placeholder={
                    formData.type === 'url'
                      ? 'https://target-domain.co/article-path'
                      : 'https://target-domain.co'
                  }
                  className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm placeholder:text-slate-600"
                />
                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  {formData.type === 'url'
                    ? 'Acquire specific asset data from the given URL'
                    : 'Systematic reconnaissance across domain hierarchy'}
                </p>
              </div>

              {/* Max Articles (for domain type) */}
              {formData.type === 'domain' && (
                <div className="bg-indigo-600/5 p-6 rounded-2xl border border-indigo-500/10">
                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">
                    Mission Payload Depth
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.maxArticles}
                    onChange={(e) =>
                      setFormData({ ...formData, maxArticles: e.target.value })
                    }
                    className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-bold text-sm"
                  />
                  <p className="text-[9px] text-indigo-400/50 font-bold uppercase tracking-widest mt-3">
                    Target maximum of {formData.maxArticles} asset analyses
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting || agentsLoading || agents.length === 0}
                  className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shadow-blue-900/20"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Initializing Uplink...
                    </>
                  ) : (
                    <>
                       <Zap className="w-4 h-4" />
                       Deploy Swarm
                    </>
                  )}
                </button>
                <Link
                  href="/qa-dashboard"
                  className="px-6 py-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-black uppercase tracking-widest text-[10px] border border-slate-700 flex items-center justify-center transition-all"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
