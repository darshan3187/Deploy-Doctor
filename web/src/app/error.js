'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#090d16] text-white text-center">
      <div className="max-w-md glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-xs text-zinc-400 font-mono mb-6 break-words">
          {error?.message || 'An unexpected rendering error occurred. Please try again.'}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 vercel-button-primary text-black font-semibold rounded-full text-xs shadow-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reload Page</span>
        </button>
      </div>
    </div>
  );
}
