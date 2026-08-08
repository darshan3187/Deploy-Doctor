'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { 
  History, 
  Search, 
  ArrowRight, 
  Calendar, 
  ArrowLeft,
  Loader2,
  Sparkles,
  Trash2
} from 'lucide-react';

export default function HistoryPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStack, setSelectedStack] = useState('ALL');

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        let res;
        const qParam = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
        try {
          res = await fetch(`/api/analyses${qParam}`);
        } catch (e) {
          res = await fetch(`http://localhost:4000/api/analyses${qParam}`);
        }
        if (res.ok) {
          const data = await res.json();
          setAnalyses(data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(loadHistory, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAnalyses = analyses.filter(item => {
    if (selectedStack === 'ALL') return true;
    return (item.detectedStack || '').toLowerCase().includes(selectedStack.toLowerCase());
  });

  const handleDeleteRecord = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this analysis record?')) return;

    try {
      let res;
      try {
        res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      } catch (err) {
        res = await fetch(`http://localhost:4000/api/analyses/${id}`, { method: 'DELETE' });
      }
      if (res.ok) {
        setAnalyses(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete analysis record:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-6xl mx-auto w-full px-4 py-6 sm:py-8 sm:px-6 lg:px-8 animate-fade-in relative z-10">
      <Navbar activeTab="history" />

      <main className="my-auto py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 glass-pill rounded-full text-xs text-zinc-300 mb-3 border border-white/10">
              <History className="w-3.5 h-3.5 text-[#0070f3]" />
              <span>Diagnostic Logs & Analysis Records</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              Deployment Audit History
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              View and revisit previously generated zerops.yaml configurations and risk diagnostic reports.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 vercel-button-primary text-black text-xs font-semibold rounded-full transition whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">New Analysis</span>
          </Link>
        </div>

        {/* Search & Filter Bar */}
        <div className="glass-card p-4 rounded-2xl mb-8 flex flex-col sm:flex-row items-center gap-4 border border-white/10">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search history by repo owner, name, or stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-xs text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {['ALL', 'nodejs', 'python', 'go', 'static', 'docker'].map(stack => (
              <button
                key={stack}
                onClick={() => setSelectedStack(stack)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition ${
                  selectedStack === stack
                    ? 'bg-white text-black font-bold'
                    : 'glass-pill text-zinc-400 hover:text-white'
                }`}
              >
                {stack}
              </button>
            ))}
          </div>
        </div>

        {/* History List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#0070f3] animate-spin mb-3" />
            <p className="text-zinc-400 text-xs font-mono">Loading analysis history...</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className="glass-card p-12 rounded-2xl text-center border border-white/10 max-w-lg mx-auto">
            <Sparkles className="w-10 h-10 text-[#50e3c2] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">No Analysis Records Found</h3>
            <p className="text-xs text-zinc-400 mb-6">
              {searchQuery ? `No results matching "${searchQuery}".` : 'Start your first repository, Dockerfile, or ZIP analysis.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 vercel-button-primary text-black text-xs font-semibold rounded-full transition"
            >
              Analyze Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAnalyses.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/a/${item.id}`)}
                className="glass-card p-5 rounded-2xl border border-white/10 hover:border-white/20 transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[#0070f3] border border-white/10">
                      {item.detectedStack}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => handleDeleteRecord(e, item.id)}
                        className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-[#0070f3] transition tracking-tight break-all mb-1">
                    {item.repoOwner ? `${item.repoOwner}/${item.repoName}` : item.repoUrl}
                  </h3>
                  <p className="text-xs font-mono text-zinc-500 truncate mb-4">
                    {item.repoUrl}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono text-[11px]">View Diagnostic Report</span>
                  <ArrowRight className="w-4 h-4 text-[#0070f3] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-6 border-t border-white/10 text-xs font-mono text-zinc-500 mt-12">
        Deploy Doctor Audit Log • Node.js + Next.js + PostgreSQL
      </footer>
    </div>
  );
}
