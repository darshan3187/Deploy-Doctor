'use client';

// RiskMeterCard component for Deploy Doctor

export default function RiskMeterCard({ risks = [] }) {
  const highCount = risks.filter(r => r.severity === 'high').length;
  const medCount = risks.filter(r => r.severity === 'medium').length;
  const lowCount = risks.filter(r => r.severity === 'low').length;

  // Calculate Health Score (100 base, -25 for high, -12 for medium, -5 for low)
  const penalty = (highCount * 25) + (medCount * 12) + (lowCount * 5);
  const healthScore = Math.max(0, 100 - penalty);

  const getStatusColor = (score) => {
    if (score >= 90) return { text: 'text-[#50e3c2]', bg: 'bg-[#50e3c2]/10', border: 'border-[#50e3c2]/30', label: 'Production Ready' };
    if (score >= 70) return { text: 'text-[#f5a623]', bg: 'bg-[#f5a623]/10', border: 'border-[#f5a623]/30', label: 'Action Recommended' };
    return { text: 'text-[#ee0000]', bg: 'bg-[#ee0000]/10', border: 'border-[#ee0000]/30', label: 'Critical Risks Detected' };
  };

  const status = getStatusColor(healthScore);

  return (
    <div className="glass-card p-5 sm:p-6 rounded-2xl relative overflow-hidden border border-white/10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Radial score box */}
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center border ${status.border} ${status.bg} shadow-inner flex-shrink-0`}>
            <span className={`text-2xl font-bold font-mono ${status.text}`}>{healthScore}</span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${status.border} ${status.bg} ${status.text}`}>
                {status.label}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Deploy Readiness Index</h3>
            <p className="text-xs text-zinc-400 font-mono">Automated LLM Risk Diagnostic</p>
          </div>
        </div>

        {/* Severity counts pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 glass-pill rounded-full border border-rose-500/30 text-rose-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ee0000]"></span>
            <span>{highCount} High</span>
          </div>
          <div className="px-3 py-1.5 glass-pill rounded-full border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f5a623]"></span>
            <span>{medCount} Med</span>
          </div>
          <div className="px-3 py-1.5 glass-pill rounded-full border border-blue-500/30 text-blue-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0070f3]"></span>
            <span>{lowCount} Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}
