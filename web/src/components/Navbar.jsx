'use client';

import Link from 'next/link';
import Logo from './Logo';
import { Search, Wrench, History } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <header className="h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 sm:pb-0 border-b border-white/10 relative z-20 mb-8">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Logo size="md" showText={true} />
        </Link>
      </div>

      {/* Center Tab Switcher & Right Status */}
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        {/* Tab Switcher */}
        <div className="flex bg-zinc-900/90 border border-white/10 p-1 rounded-full w-full sm:w-auto justify-center backdrop-blur-md">
          <button
            onClick={() => setActiveTab && setActiveTab('analyze')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition ${
              activeTab === 'analyze'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Analyze</span>
          </button>
          <button
            onClick={() => setActiveTab && setActiveTab('fix')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition ${
              activeTab === 'fix'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Fix Deploy</span>
          </button>
          <Link
            href="/history"
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition ${
              activeTab === 'history'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
