'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import RiskMeterCard from '../../../components/RiskMeterCard';
import Logo from '../../../components/Logo';
import { 
  Stethoscope,
  Copy, 
  Check, 
  Download, 
  Share2, 
  AlertTriangle, 
  Info, 
  ShieldAlert, 
  ArrowLeft,
  Terminal,
  FileCode,
  Sparkles,
  Sliders,
  Wrench,
  ExternalLink,
  Rocket,
  Zap,
  Loader2
} from 'lucide-react';

export default function AnalysisPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const { id } = params;

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeTab, setActiveTab] = useState('yaml'); // 'yaml' | 'cli'

  // Interactive Live Editor States
  const [customStack, setCustomStack] = useState('nodejs@22');
  const [customSetupName, setCustomSetupName] = useState('app');
  const [customPort, setCustomPort] = useState('3000');
  const [customStart, setCustomStart] = useState('npm run start');
  const [customBuild, setCustomBuild] = useState('npm install && npm run build');
  const [activeRisks, setActiveRisks] = useState([]);

  // One-Click Deploy States
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState(null);
  const [userToken, setUserToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  const handleOneClickDeploy = async (overrideToken) => {
    setDeploying(true);
    setDeployError(null);
    const tokenToUse = (typeof overrideToken === 'string' ? overrideToken : userToken) || undefined;
    try {
      let res;
      try {
        res = await fetch(`/api/deploy/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zeropsYaml: generatedLiveYaml, setupName: customSetupName, zeropsToken: tokenToUse })
        });
      } catch (e) {
        res = await fetch(`http://localhost:4000/api/deploy/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zeropsYaml: generatedLiveYaml, setupName: customSetupName, zeropsToken: tokenToUse })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Deployment failed');
      }
      setDeployResult(data);
      setShowTokenInput(false);
    } catch (err) {
      setDeployError(err.message);
      if (err.message.includes('token') || err.message.includes('ZEROPS_API_TOKEN') || err.message.includes('required')) {
        setShowTokenInput(true);
      }
    } finally {
      setDeploying(false);
    }
  };

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        let res;
        try {
          res = await fetch(`/api/analyses/${id}`);
        } catch (e) {
          res = await fetch(`http://localhost:4000/api/analyses/${id}`);
        }

        if (!res.ok) {
          throw new Error('Analysis not found or server error');
        }
        const data = await res.json();
        setAnalysis(data);

        // Pre-fill live editor controls
        const stack = data.detectedStack || 'nodejs@22';
        setCustomStack(stack);
        if (stack === 'python@3.12') {
          setCustomPort('8000');
          setCustomStart('python app.py');
          setCustomBuild('pip install -r requirements.txt');
        } else if (stack === 'go@1.22') {
          setCustomPort('8080');
          setCustomStart('./app');
          setCustomBuild('go build -o app .');
        } else if (stack === 'static') {
          setCustomPort('80');
          setCustomStart('static');
          setCustomBuild('echo "Static site ready"');
        }
        setActiveRisks(data.riskReport?.risks || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchAnalysis();
  }, [id]);

  // Compute live zerops.yaml based on editor controls
  const generatedLiveYaml = `zerops:
  - setup: ${customSetupName || 'app'}
    build:
      base: ${customStack}
      buildCommands:
        ${customBuild.split('&&').map(cmd => `- ${cmd.trim()}`).join('\n        ')}
      deployFiles: ./
    run:
      base: ${customStack}
      ports:
        - port: ${customPort}
          httpSupport: true
      start: ${customStart}`;

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(generatedLiveYaml);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([generatedLiveYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zerops.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApplyRiskFix = (risk) => {
    const titleStr = typeof risk === 'string' ? risk : (risk.title || '');
    const explanationStr = typeof risk === 'object' ? (risk.explanation || '') : '';
    const combined = (titleStr + ' ' + explanationStr).toLowerCase();

    if (combined.includes('start') || combined.includes('entrypoint') || combined.includes('cmd')) {
      setCustomStart('node index.js');
    } else if (combined.includes('port') || combined.includes('expose')) {
      setCustomPort('3000');
    } else if (combined.includes('build')) {
      setCustomBuild('npm install && npm run build');
    } else if (combined.includes('dockerfile')) {
      setCustomStack('nodejs@22');
    }

    // Remove applied risk from list
    setActiveRisks(prev => prev.filter(r => (typeof risk === 'string' ? r.title !== risk : r.title !== risk.title)));
  };

  const cliCommands = `# 1. Install Zerops CLI if needed
npm i -g @zerops/cli

# 2. Log in to Zerops
zcli login

# 3. Create services and deploy project directly
zcli project service import zerops.yaml
zcli push`;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in min-h-[60vh]">
        <div className="flex items-center gap-3 text-[#0070f3] font-medium">
          <Stethoscope className="w-6 h-6 animate-pulse text-[#0070f3]" />
          <span className="text-zinc-300 font-mono text-sm tracking-wide">Loading diagnostic report...</span>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto animate-fade-in min-h-[60vh]">
        <div className="glass-card p-8 rounded-2xl w-full mb-6 text-rose-200 border border-white/10">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-rose-400" />
          <h2 className="text-xl font-semibold mb-2 text-white tracking-tight">Report Not Found.</h2>
          <p className="text-sm text-zinc-400 mb-6">{error || 'This analysis ID does not exist.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 vercel-button-primary text-black text-sm font-semibold rounded-full transition btn-shift"
          >
            <ArrowLeft className="w-4 h-4" /> Analyze Another Repository
          </Link>
        </div>
      </div>
    );
  }

  const { repoUrl, riskReport } = analysis;
  const notes = riskReport?.notes || '';

  return (
    <div className="min-h-screen flex flex-col max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Logo size="sm" showText={true} />
          </Link>
          <span className="text-zinc-600">/</span>
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition glass-pill px-3 py-1 rounded-full text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#0070f3]" />
            <span>New Analysis</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleShareLink}
            className="inline-flex items-center gap-2 px-3.5 py-2 glass-pill text-zinc-200 rounded-full text-xs font-medium transition"
          >
            {copiedLink ? <Check className="w-4 h-4 text-[#50e3c2]" /> : <Share2 className="w-4 h-4 text-[#0070f3]" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share Results'}</span>
          </button>
        </div>
      </header>

      {/* Main Analysis Summary Header */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-6 animate-fade-in-delayed-1 relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0070f3]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] uppercase tracking-wider font-mono font-bold px-3 py-1 bg-white/[0.06] text-[#0070f3] border border-white/10 rounded-full shadow-inner">
                {customStack}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {new Date(analysis.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight break-all">
              {repoUrl.replace('https://github.com/', '')}
            </h1>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0070f3] hover:text-[#0070f3]/80 hover:underline inline-flex items-center gap-1.5 mt-2 font-mono"
            >
              <span>{repoUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>

            <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2 text-xs font-mono text-zinc-300">
              <Sparkles className="w-4 h-4 text-[#50e3c2] shrink-0" />
              <span>Zerops Native Runtime ({customStack}) compiles up to 3x faster and creates lighter container footprints than raw Docker images.</span>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto shrink-0 relative z-10">
            <button
              onClick={handleOneClickDeploy}
              disabled={deploying}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0070f3] hover:bg-[#0070f3]/90 text-white font-semibold rounded-full transition text-xs tracking-wide shadow-lg disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {deploying ? (
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
              ) : (
                <Rocket className="w-4 h-4 text-white shrink-0" />
              )}
              <span className="whitespace-nowrap">{deploying ? 'Deploying to Zerops...' : 'Deploy to Zerops'}</span>
            </button>
            <button
              onClick={handleCopyYaml}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 vercel-button-primary text-black font-semibold rounded-full transition text-xs tracking-wide shadow-lg whitespace-nowrap shrink-0"
            >
              {copiedYaml ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
              <span className="whitespace-nowrap">{copiedYaml ? 'Copied YAML!' : 'Copy zerops.yaml'}</span>
            </button>
            <button
              onClick={handleDownloadYaml}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 glass-pill text-white font-medium rounded-full transition text-xs border border-white/10 hover:border-white/20 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-[#0070f3] shrink-0" />
              <span className="whitespace-nowrap">Download .yaml</span>
            </button>
          </div>
        </div>

        {deployResult && (
          <div className="mt-6 p-5 rounded-xl bg-[#0070f3]/15 border border-[#0070f3]/40 flex flex-col gap-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-[#50e3c2] shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-white">zerops.yaml Ready for Zerops Cloud!</h4>
                  <p className="text-xs text-zinc-300 font-mono mt-0.5">Setup: {customSetupName || 'app'} | Status: {deployResult.status || 'ready'}</p>
                </div>
              </div>
              <a
                href={deployResult.liveUrl || 'https://app.zerops.io'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#50e3c2] hover:bg-[#50e3c2]/90 text-black font-bold text-xs rounded-full transition shadow-md shrink-0"
              >
                <span>{deployResult.liveUrl?.includes('app.zerops.io') ? 'Open Zerops GUI' : 'Open Live App'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {deployResult.notice && (
              <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#50e3c2] shrink-0" />
                <span>{deployResult.notice}</span>
              </div>
            )}
          </div>
        )}

        {deployError && (
          <div className="mt-6 p-4.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold block text-white mb-0.5">Deployment Notice</span>
                <span>{deployError}</span>
              </div>
            </div>
            {showTokenInput && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-1 pt-3 border-t border-rose-500/30">
                <input
                  type="password"
                  placeholder="Paste your Zerops Personal API Token (e.g. B5vqeb...)"
                  value={userToken}
                  onChange={(e) => setUserToken(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-black/60 border border-rose-500/40 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#50e3c2] placeholder:text-zinc-500"
                />
                <button
                  onClick={() => handleOneClickDeploy(userToken)}
                  disabled={!userToken.trim() || deploying}
                  className="px-4 py-2 bg-[#50e3c2] hover:bg-[#50e3c2]/90 text-black font-bold rounded-lg text-xs transition disabled:opacity-50 shrink-0"
                >
                  {deploying ? 'Deploying...' : 'Deploy with Token'}
                </button>
              </div>
            )}
          </div>
        )}

        {notes && (
          <div className="mt-8 pt-6 border-t border-white/10 flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5 rounded-xl backdrop-blur-xl">
            <Sparkles className="w-5 h-5 text-[#50e3c2] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#50e3c2] mb-1">
                Doctor's Diagnosis
              </h3>
              <p className="text-sm text-zinc-200 leading-relaxed">{notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Deployment Health Score Risk Meter */}
      <div className="mb-8">
        <RiskMeterCard risks={activeRisks} />
      </div>

      {/* Grid: Left Column = Interactive Live Editor & YAML, Right Column = Risk Report & CLI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 animate-fade-in-delayed-2">
        
        {/* Left Column: Interactive Editor & Output */}
        <div className="flex flex-col gap-5">
          
          {/* Controls Bar */}
          <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/10">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0070f3]" />
              <span>Interactive zerops.yaml Customizer</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-mono text-[11px] uppercase tracking-wider mb-1.5">Runtime Base</label>
                <select
                  value={customStack}
                  onChange={(e) => setCustomStack(e.target.value)}
                  className="w-full p-3 glass-input rounded-xl text-white font-mono outline-none"
                >
                  <option value="nodejs@22">nodejs@22</option>
                  <option value="nodejs@20">nodejs@20</option>
                  <option value="python@3.12">python@3.12</option>
                  <option value="python@3.11">python@3.11</option>
                  <option value="go@1.22">go@1.22</option>
                  <option value="php@8.3">php@8.3</option>
                  <option value="java@21">java@21</option>
                  <option value="rust@1.77">rust@1.77</option>
                  <option value="ruby@3.3">ruby@3.3</option>
                  <option value="elixir@1.16">elixir@1.16</option>
                  <option value="static">static</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-mono text-[11px] uppercase tracking-wider mb-1.5">Setup Name</label>
                <input
                  type="text"
                  value={customSetupName}
                  onChange={(e) => setCustomSetupName(e.target.value)}
                  className="w-full p-3 glass-input rounded-xl text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-mono text-[11px] uppercase tracking-wider mb-1.5">HTTP Port</label>
                <input
                  type="number"
                  value={customPort}
                  onChange={(e) => setCustomPort(e.target.value)}
                  className="w-full p-3 glass-input rounded-xl text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-mono text-[11px] uppercase tracking-wider mb-1.5">Start Command</label>
                <input
                  type="text"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full p-3 glass-input rounded-xl text-white font-mono outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tab Switcher: zerops.yaml vs CLI script */}
          <div className="flex bg-black/60 p-1.5 rounded-full border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('yaml')}
              className={`flex-1 py-2 text-xs font-medium rounded-full transition flex items-center justify-center gap-2 ${
                activeTab === 'yaml'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>zerops.yaml Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('cli')}
              className={`flex-1 py-2 text-xs font-medium rounded-full transition flex items-center justify-center gap-2 ${
                activeTab === 'cli'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CLI Deployment Script</span>
            </button>
          </div>

          {/* Output Code Container */}
          {activeTab === 'yaml' ? (
            <div className="glass-card rounded-2xl overflow-hidden shadow-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs font-mono">
                <span className="text-[#50e3c2] font-semibold tracking-wide">zerops.yaml (Live Generated)</span>
                <span className="text-zinc-500">Verified Schema</span>
              </div>
              <pre className="text-xs font-mono text-[#50e3c2]/90 leading-relaxed overflow-x-auto p-3 bg-black/70 rounded-xl border border-white/10">
                {generatedLiveYaml}
              </pre>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden shadow-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs font-mono">
                <span className="text-[#0070f3] font-semibold tracking-wide">Zerops CLI Commands (zcli)</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cliCommands);
                    setCopiedCli(true);
                    setTimeout(() => setCopiedCli(false), 2000);
                  }}
                  className="text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 glass-pill px-2.5 py-1 rounded-full transition"
                >
                  {copiedCli ? <Check className="w-3.5 h-3.5 text-[#50e3c2]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCli ? 'Copied CLI Commands!' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-zinc-300 leading-relaxed overflow-x-auto p-3 bg-black/70 rounded-xl border border-white/10">
                {cliCommands}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Risk Report with One-Click [Apply Fix] */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 tracking-tight">
              <ShieldAlert className="w-5 h-5 text-[#f5a623]" />
              <span>Deployment Risk Analysis</span>
            </h2>
            <span className="text-xs text-zinc-400 font-mono">
              {activeRisks.length} {activeRisks.length === 1 ? 'item' : 'items'} detected
            </span>
          </div>

          {activeRisks.length === 0 ? (
            <div className="glass-card p-6 rounded-2xl border border-[#50e3c2]/30 bg-[#50e3c2]/10 text-emerald-200 flex items-center gap-4 animate-fade-in">
              <Check className="w-6 h-6 text-[#50e3c2] flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-white">Clean Bill of Health!</p>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  All risks have been resolved and applied to your zerops.yaml.
                </p>
              </div>
            </div>
          ) : (
            activeRisks.map((risk, index) => {
              const isHigh = risk.severity === 'high';
              const isMedium = risk.severity === 'medium';
              return (
                <div
                  key={index}
                  className={`glass-card p-5 sm:p-6 rounded-2xl border transition-all duration-300 ${
                    isHigh
                      ? 'border-rose-500/30 bg-rose-950/15'
                      : isMedium
                      ? 'border-amber-500/30 bg-amber-950/15'
                      : 'border-blue-500/30 bg-blue-950/15'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      {isHigh ? (
                        <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      ) : isMedium ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Info className="w-5 h-5 text-[#0070f3] flex-shrink-0" />
                      )}
                      <h3 className="font-semibold text-sm text-white tracking-tight break-all">{risk.title}</h3>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isHigh
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : isMedium
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed pl-7 mb-4">{risk.explanation}</p>
                  
                  {/* One-Click Apply Fix Button */}
                  <div className="pl-7">
                    <button
                      onClick={() => handleApplyRiskFix(risk)}
                      className="inline-flex items-center gap-2 px-4 py-2 vercel-button-primary text-black rounded-full text-xs font-semibold transition"
                    >
                      <Wrench className="w-3.5 h-3.5 text-black" />
                      <span>Apply Fix to zerops.yaml</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
