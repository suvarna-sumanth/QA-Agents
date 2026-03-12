/**
 * QA Dashboard - Documentation Page
 * Shows system overview and specialist capabilities
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Cpu, Search, Eye, Settings, Zap } from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="p-8 pt-12 relative overflow-hidden">
      {/* Decorative background pulse */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="mb-12 relative z-10">
        <Link
          href="/qa-dashboard"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest text-[10px] mb-6 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-4 mb-3">
           <div className="p-2 bg-blue-600 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)]"><Info className="w-6 h-6 text-white" /></div>
           <h1 className="text-4xl font-black text-white uppercase tracking-tighter">System Documentation</h1>
        </div>
        <p className="text-slate-400 font-medium max-w-lg">
           Technical overview of the autonomous specialist network and swarm coordination protocols.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
         {/* Specialist Network */}
         <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-8">Specialist Network Architecture</h2>
            <div className="space-y-6">
               {[
                 { name: 'Swarm Orchestrator', icon: <Cpu />, desc: 'Primary coordination node. Manages job lifecycle, parallel distribution, and final report aggregation.' },
                 { name: 'Website Discovery', icon: <Search />, desc: 'Reconnaissance specialist. Performs sitemap analysis, domain crawling, and target vector identification.' },
                 { name: 'Player Detection', icon: <Eye />, desc: 'Visual recognition specialist. Identifies audio player components and captures high-fidelity visual evidence.' },
                 { name: 'Functional Verification', icon: <Settings />, desc: 'Core logic specialist. Validates player state, playback status, and technical performance metrics.' },
               ].map(specialist => (
                 <div key={specialist.name} className="flex gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5">
                    <div className="p-2 bg-slate-700/50 rounded-lg h-fit text-blue-400">
                       {React.cloneElement(specialist.icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
                    </div>
                    <div>
                       <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">{specialist.name}</h3>
                       <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{specialist.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Mission Protocol */}
         <div className="space-y-8">
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
               <h2 className="text-xl font-black text-white uppercase tracking-tight mb-8 text-indigo-400">Mission Protocol</h2>
               <div className="space-y-4">
                  <div className="border-l-2 border-slate-800 pl-6 relative">
                     <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-blue-500"></div>
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Phase 01: Dispatch</h3>
                     <p className="text-xs text-slate-300 font-medium italic">Initialize vector and allocate specialist nodes.</p>
                  </div>
                  <div className="border-l-2 border-slate-800 pl-6 relative">
                     <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-indigo-500"></div>
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Phase 02: Recon</h3>
                     <p className="text-xs text-slate-300 font-medium italic">Discover target URL maps and identify testing boundaries.</p>
                  </div>
                  <div className="border-l-2 border-slate-800 pl-6 relative">
                     <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-violet-500"></div>
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Phase 03: Engagement</h3>
                     <p className="text-xs text-slate-300 font-medium italic">Execute parallel functional checks and capture artifacts.</p>
                  </div>
               </div>
            </div>

            <div className="bg-indigo-600 rounded-3xl p-8 shadow-[0_0_40px_rgba(79,70,229,0.2)] flex items-center justify-between">
               <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Ready for Swarm?</h2>
                  <p className="text-indigo-100 text-xs font-medium">Deploy your first autonomous test mission now.</p>
               </div>
               <Link 
                 href="/qa-dashboard/jobs" 
                 className="p-4 bg-white rounded-2xl shadow-lg hover:scale-105 transition-transform"
               >
                  <Zap className="w-6 h-6 text-indigo-600 fill-current" />
               </Link>
            </div>
         </div>
      </div>
    </div>
  );
}
