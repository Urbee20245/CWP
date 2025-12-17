import React, { useState } from 'react';
import { 
  Activity, 
  Gauge, 
  Zap, 
  Smartphone, 
  FileCode, 
  MapPin, 
  Server, 
  ShieldCheck, 
  BarChart3, 
  Cpu, 
  Terminal,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnalyzerService } from '../src/tools/jet-local-optimizer/services/analyzer';
import { ResultsDashboard } from '../src/tools/jet-local-optimizer/components/ResultsDashboard';
import { CTASection } from '../src/tools/jet-local-optimizer/components/CTASection';
import { getCurrentBrand } from '../src/tools/jet-local-optimizer/config/brands';
import type { AnalysisResult } from '../src/tools/jet-local-optimizer/types';

const JetLocalOptimizerPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Default brand config
  const brandConfig = getCurrentBrand();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setIsScanning(true);
    setResult(null);
    
    try {
        const data = await AnalyzerService.analyzeWebsite({
            websiteUrl: url,
            businessName: undefined,
            industry: undefined
        });
        setResult(data);
    } catch (err) {
        console.error("Scan failed", err);
        alert("Scan initialization failed. Please try again.");
    } finally {
        setIsScanning(false);
    }
  };

  const resetScan = () => {
    setResult(null);
    setUrl('');
  };

  if (result) {
      return (
          <div className="min-h-screen bg-slate-50 font-sans pt-20 pb-20">
              <div className="max-w-7xl mx-auto px-6 mb-8">
                  <button 
                    onClick={resetScan}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold uppercase text-xs tracking-widest mb-8"
                  >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Scanner
                  </button>
                  <div className="text-center mb-12 animate-fade-in-up">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full font-bold text-sm mb-4">
                          <Terminal className="w-4 h-4" />
                          Analysis Complete
                      </div>
                      <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
                          Audit Results for <span className="text-indigo-600">{new URL(result.websiteUrl).hostname}</span>
                      </h1>
                      <p className="text-slate-500 max-w-2xl mx-auto">
                          Our diagnostic bot has finished crawling your site. Below is the detailed breakdown of technical performance and local SEO visibility.
                      </p>
                  </div>
                  
                  <div className="animate-fade-in-up">
                      <ResultsDashboard result={result} />
                      <CTASection brandConfig={brandConfig} result={result} />
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 pt-20">
      
      {/* 1. Technical Hero Section */}
      <header className="relative bg-slate-900 pt-12 pb-28 overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
                {/* System Status Indicator */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <div className="inline-flex items-center gap-2 text-emerald-400 font-mono text-[10px] bg-slate-800/50 px-3 py-1.5 rounded border border-slate-700">
                        <Terminal className="w-3 h-3" />
                        <span className="font-bold">JET_OPTIMIZER_V2.1</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-emerald-400 font-mono text-[10px] bg-slate-800/50 px-3 py-1.5 rounded border border-slate-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>SYSTEM ONLINE</span>
                    </div>
                    <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors font-mono text-[10px] px-3 py-1.5 bg-slate-800/50 rounded border border-slate-700 hover:border-emerald-700">
                        <span>[ Return Home ]</span>
                    </Link>
                </div>
                <div className="inline-flex items-center gap-2 text-emerald-400 font-mono text-[10px] mb-6 bg-slate-800/50 px-3 py-1 rounded border border-slate-700">
                    <span>STATUS: READY</span>
                    <span className="text-slate-600">|</span>
                    <span>LATENCY: 12ms</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
                    Technical Audit & <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Performance Diagnostics.</span>
                </h1>
                <p className="text-slate-400 text-lg mb-10 leading-relaxed max-w-xl font-light">
                    Locate the specific technical failures preventing your local business from ranking. We analyze speed, structure, and schema data.
                </p>

                <form onSubmit={handleScan} className="relative max-w-lg">
                    <div className="flex bg-slate-800/80 backdrop-blur border border-slate-600 rounded-lg overflow-hidden p-1">
                         <div className="flex-grow relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-500 font-mono text-sm">{'>'}</span>
                            </div>
                            <input 
                                type="url" 
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="enter_target_url.com" 
                                className="block w-full pl-8 pr-4 py-3 bg-transparent text-white placeholder-slate-600 focus:outline-none font-mono text-sm"
                            />
                         </div>
                         <button 
                            type="submit" 
                            disabled={isScanning}
                            className="bg-emerald-600 text-white px-6 py-2 rounded font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-wait font-mono flex items-center gap-2"
                        >
                            {isScanning ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    RUNNING...
                                </>
                            ) : (
                                'INITIATE_SCAN'
                            )}
                        </button>
                    </div>
                </form>
                <div className="mt-4 flex items-center gap-6 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> SSL Encryption</span>
                    <span>•</span>
                    <span>Passive Scan (Safe)</span>
                </div>
            </div>

            {/* Data Visualization Abstract */}
            <div className="relative hidden lg:block">
                <div className="bg-slate-950 rounded-lg border border-slate-800 p-6 font-mono text-xs shadow-2xl">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4 text-slate-500">
                        <span>DIAGNOSTIC_OUTPUT</span>
                        <span>PID: 8824</span>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-slate-500">LCP_METRIC</div>
                            <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div className="bg-red-500 h-full w-[85%]"></div>
                            </div>
                            <div className="w-12 text-right text-red-500">3.2s</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-slate-500">CLS_SHIFT</div>
                            <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full w-[15%]"></div>
                            </div>
                            <div className="w-12 text-right text-emerald-500">0.02</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-slate-500">MOBILE_VP</div>
                            <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full w-[100%]"></div>
                            </div>
                            <div className="w-12 text-right text-emerald-500">OK</div>
                        </div>
                        
                        <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded text-slate-400">
                            <span className="text-blue-400">info:</span> Detecting schema.org markup...<br/>
                            <span className="text-yellow-400">warn:</span> Multiple H1 tags found.<br/>
                            <span className="text-red-400">error:</span> Image optimization required (1.2MB).
                        </div>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute -top-4 -right-4 w-20 h-20 border-t border-r border-emerald-500/30 rounded-tr-xl"></div>
                <div className="absolute -bottom-4 -left-4 w-20 h-20 border-b border-l border-emerald-500/30 rounded-bl-xl"></div>
            </div>
        </div>
      </header>

      {/* 2. Inspection Grid (Structured) */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">System Checks</h2>
                    <p className="text-slate-500 text-sm mt-1">Analyzing 5 core performance vectors.</p>
                </div>
                <div className="font-mono text-xs text-slate-400 uppercase tracking-widest mt-4 md:mt-0">
                    Analysis_Mode: Deep
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Card 1 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <Zap className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Core_Vitals</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Speed & Latency</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Measures Time to First Byte (TTFB) and content paint times. Slow servers are penalized by Google.
                    </p>
                </div>

                {/* Card 2 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <Smartphone className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Viewport</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Mobile Usability</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Validates touch targets, font scaling, and viewport configuration for mobile devices.
                    </p>
                </div>

                {/* Card 3 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <FileCode className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Syntax</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">SEO Structure</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Crawls header tags (H1-H6), meta descriptions, and alt attributes for accessibility compliance.
                    </p>
                </div>

                {/* Card 4 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Geo_Data</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Local Relevance</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Scans for NAP consistency (Name, Address, Phone) and LocalBusiness schema markup.
                    </p>
                </div>

                {/* Card 5 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <Server className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Infrastructure</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Technical Health</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Checks SSL certificates, canonical tags, 404 errors, and asset compression.
                    </p>
                </div>

                {/* Card 6 */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg flex flex-col justify-center items-center text-center">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mb-3" />
                    <h3 className="font-bold text-white text-sm mb-1">Non-Intrusive Scan</h3>
                    <p className="text-xs text-slate-400">
                        Zero impact on site performance.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* 3. Logic/Process (Flowchart Style) */}
      <section className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                 <div>
                     <div className="inline-block px-2 py-1 bg-slate-100 border border-slate-200 text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
                         Process_Flow
                     </div>
                     <h2 className="text-3xl font-bold text-slate-900 mb-6">Execution Logic</h2>
                     <p className="text-slate-500 mb-8 leading-relaxed">
                         We strip away the marketing layer and analyze the raw HTML/CSS/JS that search engines crawl. This is a logic-based assessment.
                     </p>
                     
                     <div className="relative border-l-2 border-slate-200 ml-3 space-y-10 pl-8">
                         <div className="relative">
                             <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-mono border-4 border-white">1</div>
                             <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Input Target</h4>
                             <p className="text-sm text-slate-500 mt-1">User provides URL endpoint. System initiates handshake.</p>
                         </div>
                         <div className="relative">
                             <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-white text-slate-900 border-2 border-slate-300 flex items-center justify-center text-xs font-mono">2</div>
                             <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Crawl & Parse</h4>
                             <p className="text-sm text-slate-500 mt-1">Bot simulates mobile user agent. Captures load metrics and DOM structure.</p>
                         </div>
                         <div className="relative">
                             <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-white text-slate-900 border-2 border-slate-300 flex items-center justify-center text-xs font-mono">3</div>
                             <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Report Generation</h4>
                             <p className="text-sm text-slate-500 mt-1">Compare against Google Core Vitals baselines. Output prioritized fix list.</p>
                         </div>
                     </div>
                 </div>
                 
                 <div className="bg-slate-50 p-8 rounded border border-slate-200 font-mono text-xs">
                     <div className="space-y-3">
                         <div className="flex justify-between border-b border-slate-200 pb-2">
                             <span className="text-slate-500">CHECK_ID</span>
                             <span className="text-slate-500">STATUS</span>
                         </div>
                         <div className="flex justify-between">
                             <span>viewport_config</span>
                             <span className="text-emerald-600">[PASS]</span>
                         </div>
                         <div className="flex justify-between">
                             <span>ssl_cert_valid</span>
                             <span className="text-emerald-600">[PASS]</span>
                         </div>
                         <div className="flex justify-between">
                             <span>img_alt_tags</span>
                             <span className="text-amber-600">[WARN]</span>
                         </div>
                         <div className="flex justify-between">
                             <span>lcp_duration</span>
                             <span className="text-red-600">[FAIL] &gt; 2.5s</span>
                         </div>
                         <div className="flex justify-between">
                             <span>cls_metric</span>
                             <span className="text-emerald-600">[PASS]</span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-slate-200 text-right">
                             <span className="font-bold">Total_Score:</span> 72/100
                         </div>
                     </div>
                 </div>
             </div>
        </div>
      </section>

      {/* 4. Why This Matters (Data Driven) */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                <div className="p-6 border border-slate-800 rounded bg-slate-900/50">
                    <BarChart3 className="w-8 h-8 text-red-500 mx-auto mb-4" />
                    <div className="text-2xl font-bold mb-1 font-mono">Rankings</div>
                    <p className="text-sm text-slate-400">Technical errors prevent indexing.</p>
                </div>
                <div className="p-6 border border-slate-800 rounded bg-slate-900/50">
                    <Smartphone className="w-8 h-8 text-amber-500 mx-auto mb-4" />
                    <div className="text-2xl font-bold mb-1 font-mono">Leads</div>
                    <p className="text-sm text-slate-400">Slow load times = high bounce rate.</p>
                </div>
                <div className="p-6 border border-slate-800 rounded bg-slate-900/50">
                    <Cpu className="w-8 h-8 text-emerald-500 mx-auto mb-4" />
                    <div className="text-2xl font-bold mb-1 font-mono">Edge</div>
                    <p className="text-sm text-slate-400">Clean code outcompetes bloat.</p>
                </div>
            </div>
        </div>
      </section>

      {/* 5. CTA Section (Terminal Style) */}
      <section className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="mb-8">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <Activity className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">System Ready.</h2>
                <p className="text-slate-500">
                    Initiate diagnostics sequence to identify critical errors.
                </p>
            </div>
            
            <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
                <input 
                    type="url" 
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.yourbusiness.com" 
                    className="flex-grow px-6 py-4 rounded bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-mono text-sm"
                />
                <button 
                    type="submit" 
                    className="bg-slate-900 text-white px-8 py-4 rounded font-bold font-mono text-sm hover:bg-slate-800 transition-colors shadow-lg"
                >
                    RUN_AUDIT
                </button>
            </form>
            <p className="text-[10px] text-slate-400 mt-6 font-mono">
                NO_LOGIN_REQUIRED • SSL_SECURE • FREE_TIER
            </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-12 border-t border-slate-900 font-mono text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-slate-400">JET_LOCAL_OPTIMIZER // SYSTEM_ACTIVE</span>
            </div>
            <div>
                &copy; 2025 Custom Websites Plus.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default JetLocalOptimizerPage;
