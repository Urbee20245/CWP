import React from 'react';
import { ArrowRight, Phone, CheckCircle2, Play } from 'lucide-react';
import { NavigationLink } from '../types';

const Hero: React.FC = () => {
    const scrollToContact = () => {
        document.getElementById(NavigationLink.Contact)?.scrollIntoView({ behavior: 'smooth' });
    };

    const scrollToServices = () => {
        document.getElementById(NavigationLink.Services)?.scrollIntoView({ behavior: 'smooth' });
    };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-32 pb-20 overflow-hidden bg-slate-50">
      {/* Structural Background Grid - Precision Engineering Feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Column: Value Proposition */}
            <div className="flex flex-col items-start text-left animate-fade-in-up">
                
                {/* Availability Badge - Hyper Local */}
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100/50 text-emerald-800 text-xs font-bold uppercase tracking-widest mb-8 shadow-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Serving Loganville & Gwinnett County
                </div>

                <h1 className="text-5xl md:text-7xl font-semibold text-slate-900 tracking-tight leading-[1.1] mb-6 font-serif">
                  Your website should be your <br/>
                  <span className="text-indigo-600 relative inline-block">
                    best salesperson.
                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-indigo-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                        <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                    </svg>
                  </span>
                </h1>
                
                <p className="text-lg text-slate-600 mb-10 max-w-xl leading-relaxed font-normal">
                  Is your current site slow, outdated, or hard to use on mobile? We build high-performance websites and AI systems designed to turn local search traffic into paying jobs.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                  <button 
                    onClick={scrollToContact}
                    className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-semibold transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/10 active:scale-95 flex items-center justify-center gap-2"
                  >
                    Get A Free Site Audit
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={scrollToServices}
                    className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    See How It Works
                  </button>
                </div>

                {/* Positioning / Credibility Line */}
                <div className="mt-10 flex flex-wrap items-center gap-6 text-sm font-medium text-slate-500">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Focused on ROI, not vanity metrics</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>100% Local to Walton County</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Visual Proof / Dashboard Abstract */}
            <div className="relative hidden lg:block animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="relative z-10 bg-white rounded-2xl shadow-2xl shadow-indigo-900/10 border border-slate-100 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-700">
                    {/* Fake Browser Header */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                            <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                        </div>
                        <div className="flex-1 bg-white mx-4 h-6 rounded-md shadow-sm border border-slate-100"></div>
                    </div>
                    {/* Content Preview */}
                    <div className="p-8 grid grid-cols-2 gap-6 bg-white">
                        <div className="col-span-2 h-32 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                            Mobile-First Design Structure
                        </div>
                        <div className="h-24 bg-indigo-50 rounded-xl border border-indigo-100 p-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500 mb-2"></div>
                            <div className="w-16 h-2 bg-indigo-200 rounded-full"></div>
                        </div>
                        <div className="h-24 bg-slate-50 rounded-xl border border-slate-100 p-4">
                             <div className="w-8 h-8 rounded-lg bg-emerald-400 mb-2"></div>
                             <div className="w-16 h-2 bg-slate-200 rounded-full"></div>
                        </div>
                    </div>
                    {/* Floating Call Card */}
                    <div className="absolute -bottom-6 -left-6 bg-slate-900 text-white p-4 rounded-xl shadow-xl flex items-center gap-4 max-w-xs">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                            <Phone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">AI Receptionist</div>
                            <div className="font-bold text-sm">Missed Calls: 0</div>
                        </div>
                    </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -z-10"></div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;