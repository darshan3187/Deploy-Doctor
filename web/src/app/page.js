'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import FeaturesShowcase from '../components/FeaturesShowcase';
import { 
  ArrowRight, 
  Loader2, 
  Sparkles,
  Github,
  AlertCircle,
  Wrench,
  Terminal,
  FileCode,
  Archive,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Check,
  Copy
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analyze'); // 'analyze' | 'fix'

  // Input Type for Analyze tab
  const [inputType, setInputType] = useState('github'); // 'github' | 'dockerfile' | 'zip'

  // Analyze state
  const [repoUrl, setRepoUrl] = useState('');
  const [dockerfileText, setDockerfileText] = useState('');
  const [dockerfileFile, setDockerfileFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);

  // Fix tab state
  const [brokenYaml, setBrokenYaml] = useState('');
  const [buildLog, setBuildLog] = useState('');
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState(null);
  const [copiedFixedYaml, setCopiedFixedYaml] = useState(false);

  const analysisSteps = [
    'Connecting to input source...',
    'Analyzing repository file structure & dependencies...',
    'Detecting runtime stack & framework specification...',
    'Generating production-ready zerops.yaml...',
    'Running LLM deployment risk analysis...'
  ];

  useEffect(() => {
    async function fetchRecent() {
      try {
        const res = await fetch('/api/analyses');
        if (res.ok) {
          const data = await res.json();
          setRecentAnalyses(data);
        }
      } catch (err) {
        // quiet fallback
      }
    }
    fetchRecent();
  }, []);

  const startStepAnimation = () => {
    setStepIndex(0);
    return setInterval(() => {
      setStepIndex((prev) => (prev < analysisSteps.length - 1 ? prev + 1 : prev));
    }, 700);
  };

  const handleAnalyzeGitHub = async (e) => {
    if (e) e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setError(null);
    const stepInterval = startStepAnimation();

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${res.status})`);
      }

      const data = await res.json();
      router.push(`/a/${data.id}`);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAnalyzeDockerfile = async (e) => {
    if (e) e.preventDefault();
    if (!dockerfileText.trim() && !dockerfileFile) return;

    setLoading(true);
    setError(null);
    const stepInterval = startStepAnimation();

    try {
      const formData = new FormData();
      if (dockerfileFile) {
        formData.append('file', dockerfileFile);
      } else {
        formData.append('dockerfileContent', dockerfileText);
      }

      const res = await fetch('/api/analyze-dockerfile', {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Dockerfile analysis failed (${res.status})`);
      }

      const data = await res.json();
      router.push(`/a/${data.id}`);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAnalyzeZip = async (e) => {
    if (e) e.preventDefault();
    if (!zipFile) return;

    setLoading(true);
    setError(null);
    const stepInterval = startStepAnimation();

    try {
      const formData = new FormData();
      formData.append('file', zipFile);

      const res = await fetch('/api/analyze-zip', {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `ZIP upload failed (${res.status})`);
      }

      const data = await res.json();
      router.push(`/a/${data.id}`);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleFix = async (e) => {
    if (e) e.preventDefault();
    if (!brokenYaml.trim() && !buildLog.trim()) return;

    setFixing(true);
    setError(null);
    setFixResult(null);

    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zeropsYaml: brokenYaml, buildLog }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Diagnosis failed (${res.status})`);
      }

      const data = await res.json();
      setFixResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  const sampleRepos = [
    { name: 'Express.js API', url: 'https://github.com/expressjs/express' },
    { name: 'Next.js App Router', url: 'https://github.com/vercel/next.js' },
    { name: 'Python Flask', url: 'https://github.com/pallets/flask' }
  ];

  const sampleDockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;

  const sampleErrorLog = `npm ERR! missing script: start
npm ERR! A complete log of this run can be found in: /root/.npm/_logs/2026-08-07T12_00_00_000Z-debug.log
Process exited with code 1
Error: port 3000 is not exposed in run.ports`;

  return (
    <div className="min-h-screen flex flex-col justify-between max-w-6xl mx-auto w-full px-4 py-6 sm:py-8 sm:px-6 lg:px-8 animate-fade-in relative z-10">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Section */}
      <main className="my-auto py-4 sm:py-6 animate-fade-in-delayed-1">
        {activeTab === 'analyze' ? (
          <>
            {/* Hero Banner */}
            <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 glass-pill rounded-full text-xs text-zinc-300 mb-6 shadow-inner border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-[#50e3c2]" />
                <span>Instant stack detection & deployment risk auditing</span>
              </div>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-tight mb-4">
                Analyze any code, get a valid <span className="vercel-gradient-text">zerops.yaml.</span>
              </h2>
              <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
                Analyze GitHub repositories, Dockerfiles, or ZIP project archives to generate verified Zerops cloud configurations.
              </p>
            </div>

            {/* Input Type Switcher Tabs */}
            <div className="max-w-2xl mx-auto mb-4 flex bg-black/60 p-1.5 rounded-full border border-white/10 backdrop-blur-xl">
              <button
                onClick={() => setInputType('github')}
                className={`flex-1 py-2 text-xs font-medium rounded-full transition flex items-center justify-center gap-2 ${
                  inputType === 'github'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub URL</span>
              </button>

              <button
                onClick={() => setInputType('dockerfile')}
                className={`flex-1 py-2 text-xs font-medium rounded-full transition flex items-center justify-center gap-2 ${
                  inputType === 'dockerfile'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Dockerfile</span>
              </button>

              <button
                onClick={() => setInputType('zip')}
                className={`flex-1 py-2 text-xs font-medium rounded-full transition flex items-center justify-center gap-2 ${
                  inputType === 'zip'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>ZIP Upload</span>
              </button>
            </div>

            {/* Input Form Card */}
            <div className="max-w-2xl mx-auto glass-card p-5 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-white/10">
              
              {/* 1. GITHUB REPO FORM */}
              {inputType === 'github' && (
                <form onSubmit={handleAnalyzeGitHub} className="space-y-4">
                  <div className="flex flex-col sm:relative sm:flex-row gap-2 sm:gap-0">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                        <Github className="w-5 h-5" />
                      </div>
                      <input
                        type="url"
                        required
                        disabled={loading}
                        placeholder="https://github.com/owner/repository"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="w-full pl-11 pr-4 sm:pr-36 h-12 glass-input rounded-xl text-sm outline-none text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !repoUrl.trim()}
                      className="w-full sm:w-auto sm:absolute sm:right-1.5 sm:top-1.5 sm:bottom-1.5 px-6 py-3.5 sm:py-0 vercel-button-primary disabled:opacity-50 text-black text-xs font-semibold tracking-wide rounded-full transition flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>Analyze Repo</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Sample Repos */}
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-zinc-400 font-mono text-[11px] uppercase tracking-wider">Examples:</span>
                      {sampleRepos.map((sample) => (
                        <button
                          type="button"
                          key={sample.url}
                          onClick={() => {
                            setRepoUrl(sample.url);
                            setTimeout(() => {
                              const submitBtn = document.querySelector('button[type="submit"]');
                              if (submitBtn) submitBtn.click();
                            }, 50);
                          }}
                          className="px-3 py-1.5 glass-pill text-zinc-300 hover:text-white rounded-full transition font-mono text-[11px] flex items-center gap-1 hover:border-[#0070f3]"
                        >
                          <span>{sample.name}</span>
                          <Sparkles className="w-3 h-3 text-[#50e3c2]" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Security Trust Badge */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] font-mono text-zinc-400">
                    <ShieldCheck className="w-4 h-4 text-[#50e3c2]" />
                    <span>100% Read-Only Inspection • Code analyzed in-memory and never stored</span>
                  </div>
                </form>
              )}

              {/* 2. DOCKERFILE FORM */}
              {inputType === 'dockerfile' && (
                <form onSubmit={handleAnalyzeDockerfile} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-[#50e3c2]" />
                        <span>Paste Dockerfile or Upload File</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setDockerfileText(sampleDockerfile);
                          setDockerfileFile(null);
                        }}
                        className="text-[11px] font-mono text-[#0070f3] hover:underline"
                      >
                        Paste Sample Dockerfile
                      </button>
                    </div>

                    <textarea
                      rows={6}
                      disabled={loading}
                      placeholder={`FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]`}
                      value={dockerfileText}
                      onChange={(e) => {
                        setDockerfileText(e.target.value);
                        setDockerfileFile(null);
                      }}
                      className="w-full p-3.5 glass-input rounded-xl text-xs font-mono text-white outline-none mb-3"
                    />

                    <div className="flex items-center justify-between gap-4">
                      <label className="flex-1 cursor-pointer p-3 border border-dashed border-white/20 hover:border-[#0070f3] rounded-xl text-center text-xs text-zinc-400 hover:text-white transition bg-black/40">
                        <input
                          type="file"
                          accept=".dockerfile,Dockerfile,text/plain"
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              setDockerfileFile(e.target.files[0]);
                              setDockerfileText('');
                            }
                          }}
                          className="hidden"
                        />
                        <span>{dockerfileFile ? `Selected: ${dockerfileFile.name}` : 'Or Choose Dockerfile File...'}</span>
                      </label>

                      <button
                        type="submit"
                        disabled={loading || (!dockerfileText.trim() && !dockerfileFile)}
                        className="px-6 py-3 vercel-button-primary disabled:opacity-50 text-black text-xs font-semibold rounded-full transition flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Converting...</span>
                          </>
                        ) : (
                          <>
                            <span>Convert Dockerfile</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* 3. ZIP ARCHIVE FORM */}
              {inputType === 'zip' && (
                <form onSubmit={handleAnalyzeZip} className="space-y-4">
                  <div className="text-center p-8 border-2 border-dashed border-white/20 hover:border-[#0070f3] rounded-2xl transition bg-black/40 relative">
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      required
                      disabled={loading}
                      onChange={(e) => setZipFile(e.target.files[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-10 h-10 text-[#0070f3] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-white mb-1">
                      {zipFile ? zipFile.name : 'Drop your project .zip archive here'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {zipFile ? `${(zipFile.size / 1024 / 1024).toFixed(2)} MB` : 'Or click to select a local ZIP file'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading || !zipFile}
                      className="w-full sm:w-auto px-6 py-3 vercel-button-primary disabled:opacity-50 text-black text-xs font-semibold rounded-full transition flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Unpacking & Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>Analyze ZIP Archive</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step Progress */}
              {loading && (
                <div className="mt-6 p-5 glass-card rounded-xl text-left animate-fade-in border border-[#0070f3]/30">
                  <div className="flex items-center gap-3 mb-3 text-[#0070f3] font-medium text-xs font-mono">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0070f3]" />
                    <span>{analysisSteps[stepIndex]}</span>
                  </div>
                  <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-[#0070f3] via-[#7928ca] to-[#50e3c2] h-full transition-all duration-500 shadow-[0_0_10px_rgba(0,112,243,0.8)]"
                      style={{ width: `${((stepIndex + 1) / analysisSteps.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-5 p-4 glass-card border border-rose-500/40 bg-rose-950/20 rounded-xl text-rose-200 text-xs flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Features Showcase Grid */}
            <FeaturesShowcase />
          </>
        ) : (
          /* FIX BROKEN DEPLOY TAB */
          <div className="max-w-4xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-3xl font-semibold text-white mb-2 tracking-tight">
                Fix My Failing Deploy.
              </h2>
              <p className="text-zinc-400 text-sm">
                Paste your existing <code className="text-[#0070f3] font-mono bg-white/[0.04] px-2 py-0.5 rounded border border-white/10">zerops.yaml</code> and your build/deploy error log to pinpoint the exact failure and generate a working fix.
              </p>
            </div>

            <form onSubmit={handleFix} className="space-y-6 glass-card p-6 sm:p-8 rounded-2xl shadow-2xl border border-white/10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider mb-2">
                    Existing zerops.yaml (Optional)
                  </label>
                  <textarea
                    rows={6}
                    placeholder={`zerops:\n  - setup: app\n    build:\n      base: node:latest\n    run:\n      start: npm start`}
                    value={brokenYaml}
                    onChange={(e) => setBrokenYaml(e.target.value)}
                    className="w-full p-3.5 glass-input rounded-xl text-xs font-mono text-zinc-200 outline-none placeholder-zinc-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-rose-400" />
                      <span>Build / Deploy Error Log</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setBuildLog(sampleErrorLog)}
                      className="text-[11px] font-mono text-[#0070f3] hover:text-[#0070f3]/80 hover:underline transition"
                    >
                      Paste Sample Error Log
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    placeholder={`Paste error log output here (e.g. npm ERR! missing script: start, port 3000 not exposed)`}
                    value={buildLog}
                    onChange={(e) => setBuildLog(e.target.value)}
                    className="w-full p-3.5 glass-input rounded-xl text-xs font-mono text-rose-300 outline-none placeholder-zinc-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={fixing || (!brokenYaml.trim() && !buildLog.trim())}
                  className="w-full sm:w-auto px-6 py-3 vercel-button-primary disabled:opacity-50 text-black font-semibold rounded-full text-xs tracking-wide transition flex items-center justify-center gap-2 shadow-lg"
                >
                  {fixing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Diagnosing Error...</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4" />
                      <span>Diagnose & Fix Deploy</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Fix Result Diff View */}
            {fixResult && (
              <div className="mt-8 glass-card rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in border border-white/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#50e3c2] flex-shrink-0" />
                    <h3 className="font-semibold text-white text-base tracking-tight">Diagnosis & Auto-Fix Complete</h3>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fixResult.fixedYaml);
                      setCopiedFixedYaml(true);
                      setTimeout(() => setCopiedFixedYaml(false), 2000);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 vercel-button-primary text-black text-xs font-semibold rounded-full transition"
                  >
                    {copiedFixedYaml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFixedYaml ? 'Copied Fixed YAML!' : 'Copy Fixed zerops.yaml'}</span>
                  </button>
                </div>

                {/* Detected Issues */}
                <div className="space-y-3 mb-6">
                  {fixResult.issues.map((item, idx) => (
                    <div key={idx} className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                      <h4 className="text-xs font-mono font-medium text-[#50e3c2] mb-1 flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5" />
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-300">{item.explanation}</p>
                    </div>
                  ))}
                </div>

                {/* Side by Side / Fixed Code Output */}
                <div className="bg-black/60 p-4 rounded-xl border border-white/10 overflow-x-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs text-zinc-400 font-mono">
                    <span>Corrected zerops.yaml</span>
                    <span className="text-[#50e3c2] font-medium">Verified Syntax</span>
                  </div>
                  <pre className="text-xs font-mono text-[#50e3c2] leading-relaxed">
                    {fixResult.fixedYaml}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Feed */}
        {activeTab === 'analyze' && recentAnalyses.length > 0 && (
          <div className="max-w-2xl mx-auto mt-12 animate-fade-in-delayed-2">
            <h3 className="text-xs uppercase font-mono tracking-wider font-medium text-zinc-400 text-left mb-4">
              Recent Analyses Activity
            </h3>
            <div className="space-y-3">
              {recentAnalyses.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/a/${item.id}`)}
                  className="w-full p-4 glass-card rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-200 text-left group border border-white/10 hover:border-white/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-1 bg-white/[0.06] text-[#0070f3] border border-white/10 rounded-full">
                      {item.detectedStack}
                    </span>
                    <span className="text-xs font-mono text-zinc-200 group-hover:text-[#0070f3] transition">
                      {item.repoOwner ? `${item.repoOwner}/${item.repoName}` : item.repoUrl}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 border-t border-white/10 text-xs font-mono text-zinc-500">
        Built for The Zerops Challenge • Node.js + Next.js + PostgreSQL
      </footer>
    </div>
  );
}
