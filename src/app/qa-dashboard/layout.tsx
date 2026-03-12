/**
 * QA Dashboard Layout
 * Shared navigation and styling for dashboard pages
 */

import React from 'react';
import Link from 'next/link';
import { BarChart3, Zap } from 'lucide-react';

export default function QADashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/qa-dashboard" className="flex items-center gap-3 hover:opacity-80 group">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="hidden sm:block text-lg font-black text-white uppercase tracking-tighter">
                Mission Control
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link
                href="/qa-dashboard"
                className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/qa-dashboard/jobs"
                className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Launch Job
              </Link>
              <Link
                href="/qa-dashboard/docs"
                className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Docs
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10">{children}</main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-12 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
              QA Dashboard v2.1.0-swarm-live • Autonomous Specialist Network
            </div>
            <div className="flex items-center gap-4">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Global Telemetry Active</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
