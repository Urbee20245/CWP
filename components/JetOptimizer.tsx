import React from 'react';
import { Activity, Smartphone, MapPin, Gauge, FileSearch, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const JetOptimizer: React.FC = () => {
  const checks = [
    {
      icon: Gauge,
      title: "Core Web Vitals",
      desc: "Measures load speed and visual stability against Google's 2024 standards."
    },
    {
      icon: Smartphone,
      title: "Mobile Responsiveness",
      desc: "Checks touch targets and viewport scaling for phone users."
    },
    {
      icon: MapPin,
      title: "Local Relevance",
      desc: "Scans for NAP (Name, Address, Phone) consistency across the web."
    },
    {
      icon: FileSearch,
      title: "SEO Structure",
      desc: "Validates headings, meta tags, and schema markup for search crawlers."
    }
  ];

  return (
    <section id="optimizer" className="py-24 bg-indigo-50/30 border-y border-indigo-100 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wide mb-6">
              <Activity className="w-3 h-3" />
              <span>Free Diagnostic Tool</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-serif text-slate-900 mb-6">
              Jet Local Optimizer
            </h2>
            
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Before we build, we analyze. The Jet Local Optimizer is our proprietary health audit that looks under the hood of your current digital presence.
            </p>
            
            <p className="text-slate-500 mb-10 leading-relaxed">
              Most business owners know their website is "old," but they don't know exactly <em>where</em> it's failing. This audit gives you a clear, jargon-free roadmap of your site's technical health, speed, and local visibility—so you can make data-backed decisions about your next step.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
              {checks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                    <check.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{check.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-normal">{check.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/jet-local-optimizer" className="inline-flex bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95 items-center gap-2 group">
              Get Your Free Health Report
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-xs text-slate-400 mt-4 ml-1">
              *Takes less than 2 minutes. No credit card required.
            </p>
          </div>

          {/* Right Column: Visual Interface */}
          <div className="relative">
            <div className="relative bg-white rounded-2xl shadow-2xl shadow-indigo-200/50 border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="font-mono text-sm font-bold text-slate-700">System_Scan_v2.4</span>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Score Gauge Abstract */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Overall Health Score</div>
                            <div className="text-3xl font-bold text-slate-900 mt-1">-- / 100</div>
                        </div>
                        <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin"></div>
                    </div>

                    {/* Loading Lines */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-medium text-slate-500">
                            <span>Analyzing Site Structure...</span>
                            <span className="text-emerald-600">Complete</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full w-full"></div>
                        </div>

                        <div className="flex justify-between text-xs font-medium text-slate-500 pt-2">
                            <span>Testing Mobile Viewport...</span>
                            <span className="text-indigo-600 animate-pulse">Running...</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full w-[60%] animate-pulse"></div>
                        </div>

                        <div className="flex justify-between text-xs font-medium text-slate-500 pt-2">
                            <span>Checking Local Schema...</span>
                            <span className="text-slate-400">Pending</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-slate-300 h-2 rounded-full w-0"></div>
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                            <span className="font-bold">Did you know?</span> Sites with a score under 70 often struggle to appear in the "Local Pack" (the map section) of search results.
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Floating Element */}
            <div className="absolute -bottom-6 -right-6 bg-slate-900 text-white p-4 rounded-xl shadow-xl border border-slate-700 max-w-[200px] animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-mono text-slate-300">Issue Detected</span>
                </div>
                <div className="text-sm font-bold">Large Image Files</div>
                <div className="text-xs text-slate-400"> slowing down LCP by 2.4s</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default JetOptimizer;