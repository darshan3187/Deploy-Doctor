'use client';

import { Cpu, ShieldCheck, Terminal, Zap } from 'lucide-react';

export default function FeaturesShowcase() {
  const features = [
    {
      icon: Cpu,
      title: 'Multi-Stack Detection',
      description: 'Automatically scans GitHub AST & package manifests for Node.js, Python, Go, Rust, and Static runtimes.'
    },
    {
      icon: ShieldCheck,
      title: 'LLM Risk Diagnostic',
      description: 'Pinpoints unexposed HTTP ports, missing start scripts, or build command failures before Zerops deployment.'
    },
    {
      icon: Terminal,
      title: 'Zerops CLI Integration',
      description: 'Generates copy-paste zcli project service import commands and zcli push workflows for instant deployment.'
    },
    {
      icon: Zap,
      title: '1-Click Auto Fixer',
      description: 'Pass failing build logs or broken zerops.yaml files to get an automated, corrected configuration diff.'
    }
  ];

  return (
    <div className="mt-16 sm:mt-24">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-[#0070f3] mb-2">
          Engineered for Zerops Cloud
        </h3>
        <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight leading-snug">
          Everything you need for zero-friction deployments.
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div key={idx} className="glass-card p-6 rounded-2xl flex flex-col justify-between group border border-white/10 hover:border-white/20 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white mb-4 group-hover:border-blue-500/40 group-hover:bg-blue-500/10 transition-all">
                  <Icon className="w-5 h-5 text-[#50e3c2]" />
                </div>
                <h4 className="text-base font-semibold text-white mb-2 tracking-tight">
                  {feat.title}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  {feat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
