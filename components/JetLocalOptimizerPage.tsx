import React from 'react';
import { JetLocalOptimizer } from '../src/tools/jet-local-optimizer/JetLocalOptimizer';
import { 
  Activity, 
  Zap, 
  Smartphone, 
  FileCode, 
  MapPin, 
  Terminal,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const JetLocalOptimizerPage: React.FC = () => {
  const scrollToAnalyzer = () => {
    const analyzerSection = document.getElementById('analyzer-tool');
    analyzerSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Hero Section with Integrated System Status - Positioned below fixed main header */}
      <header className="relative bg-slate-900 pt-28 md:pt-32 pb-20 overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
            {/* System Status Header - Technical Monitoring Aesthetic */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8 pb-6 border-b border-slate-800/50">
                <div className="flex items-center gap-3 mb-4 sm:mb-0">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <span className="font-mono text-sm font-bold tracking-tight text-emerald-400">
                        JET_OPTIMIZER_V2.1
                    </span>
                    <span className="hidden sm:inline text-slate-600 font-mono">|</span>
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-400">SYSTEM ONLINE</span>
                    </div>
                </div>
                <Link 
                    to="/" 
                    className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-mono uppercase tracking-wider flex items-center gap-2 group"
                >
                    <span className="group-hover:translate-x-[-4px] transition-transform">←</span>
                    Return_Home
                </Link>
            </div>
            
            {/* Mobile System Status */}
            <div className="sm:hidden flex items-center justify-center gap-2 text-xs text-slate-500 font-mono mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-emerald-400">SYSTEM ONLINE</span>
            </div>

            {/* Hero Content */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 text-emerald-400 font-mono text-[10px] mb-6 bg-slate-800/50 px-3 py-1 rounded border border-slate-700">
                    <span>STATUS: READY</span>
                    <span className="text-slate-600">|</span>
                    <span>FREE ANALYSIS TOOL</span>
                </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight max-w-4xl mx-auto">
                Technical Website Audit & <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Performance Diagnostics</span>
            </h1>
            <p className="text-slate-400 text-xl mb-10 leading-relaxed max-w-3xl mx-auto font-light">
                Analyze your website's performance, SEO, and local optimization using real data from Google PageSpeed Insights. Get actionable insights in seconds.
            </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button 
                        onClick={scrollToAnalyzer}
                        className="bg-emerald-600 text-white px-8 py-4 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-emerald-500 transition-colors shadow-lg"
                    >
                        Start Free Analysis
                    </button>
                    <div className="flex items-center gap-6 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> SSL Secure</span>
                        <span>•</span>
                        <span>No Login Required</span>
                    </div>
                </div>
            </div>
        </div>
      </header>

      {/* What We Analyze Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">What We Analyze</h2>
                    <p className="text-slate-500 text-sm mt-1">Powered by Google PageSpeed Insights & Real-Time Data</p>
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
                    <h3 className="font-bold text-slate-900 mb-2">Speed & Performance</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Real Core Web Vitals from Google: LCP (load speed), FID (interactivity), and CLS (visual stability).
                    </p>
                </div>

                {/* Card 2 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <Smartphone className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Mobile</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Mobile Responsiveness</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Validates viewport configuration, touch targets, and mobile usability from real device testing.
                    </p>
                </div>

                {/* Card 3 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <FileCode className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">SEO</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">SEO Structure</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Checks meta tags, H1 headings, title tags, schema markup, and image optimization.
                    </p>
                </div>

                {/* Card 4 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Local</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Local Relevance</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Scans for NAP consistency (Name, Address, Phone) and Google Maps integration.
                    </p>
                </div>

                {/* Card 5 */}
                <div className="bg-white border border-slate-200 p-6 rounded-lg hover:border-emerald-400 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase border border-slate-100 px-2 py-0.5 rounded">Keywords</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Keyword Gap Analysis</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Industry-specific keyword checking to identify missing opportunities for your business.
                    </p>
                </div>

                {/* Card 6 */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg flex flex-col justify-center items-center text-center">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mb-3" />
                    <h3 className="font-bold text-white text-sm mb-1">100% Client-Side</h3>
                    <p className="text-xs text-slate-400">
                        Your data never touches our servers.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* Actual Working Analyzer Tool */}
      <section id="analyzer-tool" className="py-16 bg-white border-y border-slate-200">
        <JetLocalOptimizer />
      </section>

      {/* Why This Matters Section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Why Website Performance Matters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                <div className="p-6 border border-slate-800 rounded bg-slate-900/50">
                    <Activity className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <div className="text-3xl font-bold mb-3">53%</div>
                    <p className="text-sm text-slate-400">of mobile users abandon sites that take over 3 seconds to load</p>
                </div>
                <div className="p-6 border border-slate-800 rounded bg-slate-900/50">
                    <Smartphone className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                    <div className="text-3xl font-bold mb-3">67%</div>
                    <p className="text-sm text-slate-400">of local searches result in conversions - but only if your site performs well</p>
                </div>
                <div className="p-6 border border-slate-800 rounded bg-slate-900/50">
                    <Zap className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <div className="text-3xl font-bold mb-3">2X</div>
                    <p className="text-sm text-slate-400">faster sites can double their conversion rates and search rankings</p>
                </div>
            </div>
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
                &copy; 2025 Custom Websites Plus. Powered by Google PageSpeed Insights.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default JetLocalOptimizerPage;
