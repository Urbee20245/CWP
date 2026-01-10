import React from 'react';
import { ArrowRight, Phone, CheckCircle2, Play, TrendingUp, Star } from 'lucide-react';
import { NavigationLink } from '../types';
import { Link } from 'react-router-dom';

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-20 overflow-hidden bg-slate-50 lg:pt-32">
      {/* Structural Background Grid - Precision Engineering Feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Value Proposition */}
            <div className="flex flex-col items-start text-left animate-fade-in-up">
                
                {/* Availability Badge - Hyper Local */}
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100/50 text-emerald-800 text-xs font-bold uppercase tracking-widest mb-8 shadow-sm hover:shadow-md transition-shadow">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Serving Loganville & Gwinnett County
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-slate-900 tracking-tight leading-[1.1] mb-6 font-serif">
                  Your website should be your
                  <br/>
                  <span className="text-indigo-600 relative inline-block">
                    best salesperson.
                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-indigo-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                        <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                    </svg>
                  </span>
                  <br/>
                  <span className="text-slate-700 text-3xl sm:text-4xl lg:text-5xl font-normal mt-4 block">
                    Working 24/7 to book local jobs.
                  </span>
                </h1>
                
                <p className="text-lg text-slate-600 mb-10 max-w-xl leading-relaxed font-normal">
                  We build high-performance websites & AI systems for contractors that convert search traffic into scheduled jobs—starting with a free, detailed audit of your current site.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                  <Link 
                    to="/free-audit" // Changed from /jetsuite
                    className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-semibold transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/10 active:scale-95 hover:scale-[1.02] duration-300 group"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Get Your Free Site Audit
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="block text-xs font-normal opacity-80 mt-1 text-center">
                      Limited slots available this month
                    </span>
                  </Link>
                  
                  <a 
                    href={`#${NavigationLink.Services}`}
                    className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] duration-300 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    See How It Works
                  </a>
                </div>

                {/* Positioning / Credibility Line */}
                <div className="mt-10 flex flex-wrap items-center gap-4 sm:gap-6 text-sm font-medium text-slate-500">
                    <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>Focused on ROI, not vanity metrics</span>
                    </div>
                    <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>100% Local to Walton County</span>
                    </div>
                    <div className="flex items-center gap-2 hover:scale-105 transition-transform duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>No templates, only custom solutions</span>
                    </div>
                </div>

                {/* Social Proof Section */}
                <div className="mt-12 pt-8 border-t border-slate-100 w-full">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3 flex-shrink-0">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-200 border-2 border-white"></div>
                      ))}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map((i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="ml-2 text-sm font-semibold text-slate-700">5.0</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        Trusted by <span className="font-semibold text-slate-900">40+</span> local contractors
                      </p>
                    </div>
                  </div>
                </div>
            </div>

            {/* Right Column: Visual Proof / Dashboard Abstract (Desktop) */}
            <div className="relative hidden lg:block animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="relative z-10 bg-white rounded-2xl shadow-2xl shadow-indigo-900/10 border border-slate-100 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-700">
                    {/* Fake Browser Header */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                        </div>
                        <div className="flex-1 bg-white mx-4 h-6 rounded-md shadow-sm border border-slate-100 flex items-center px-3">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full"></div>
                        </div>
                        <div className="w-6 h-6 rounded-md bg-slate-200"></div>
                    </div>
                    
                    {/* Content Preview - Contractor Dashboard */}
                    <div className="p-6 space-y-6 bg-white">
                      {/* Lead metrics */}
                      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-50 to-emerald-50/50 rounded-xl border border-emerald-100">
                        <div>
                          <div className="text-2xl font-bold text-slate-900">47</div>
                          <div className="text-sm text-slate-600">Leads This Month</div>
                        </div>
                        <div className="relative">
                          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                            <div className="text-xs font-bold text-emerald-600">+24%</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Conversion visualization */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Conversion Rate</span>
                          <span className="text-sm font-bold text-emerald-600">8.3%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full w-5/6"></div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Jobs Booked</span>
                          <span className="text-sm font-bold text-indigo-600">83%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full w-[83%]"></div>
                        </div>
                      </div>
                      
                      {/* Performance stats */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                          <div className="text-lg font-bold text-slate-900">0.8s</div>
                          <div className="text-xs text-slate-500">Load Time</div>
                        </div>
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                          <div className="text-lg font-bold text-slate-900">97%</div>
                          <div className="text-xs text-slate-500">Mobile Score</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Floating Call Card */}
                    <div className="absolute -bottom-6 -left-6 bg-slate-900 text-white p-5 rounded-xl shadow-xl flex items-center gap-4 max-w-xs border border-slate-700 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center animate-pulse shadow-lg shadow-green-500/30">
                            <Phone className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs text-slate-400 font-medium">AI Receptionist Active</div>
                            <div className="font-bold text-sm">Missed Calls: 0</div>
                            <div className="text-xs text-emerald-400 mt-1">✓ 24/7 Call Answering</div>
                        </div>
                    </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute top-1/2 right-20 w-32 h-32 bg-purple-400/5 rounded-full blur-2xl -z-10"></div>
            </div>
        </div>

        {/* Mobile-Only Simple Visual */}
        <div className="relative lg:hidden mt-12 animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100 hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xl font-semibold text-slate-900">Contractor Results</div>
              <div className="text-xs px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 rounded-full font-bold">
                +240% Leads
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl mb-3 flex flex-col items-center justify-center border-2 border-slate-200">
                  <div className="text-5xl font-bold text-slate-400 mb-2">2</div>
                  <div className="text-sm text-slate-500 px-4">Leads/Month</div>
                </div>
                <div className="text-sm font-medium text-slate-500">Old Website</div>
              </div>
              <div className="text-center">
                <div className="h-40 bg-gradient-to-br from-indigo-50 to-white rounded-xl mb-3 flex flex-col items-center justify-center border-2 border-indigo-100 relative overflow-hidden">
                  <div className="absolute top-3 right-3 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-5xl font-bold text-indigo-600 mb-2">15+</div>
                  <div className="text-sm text-indigo-700 px-4 font-medium">Leads/Month</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">Custom Website</div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-600">
                Average results for contractors after 90 days
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
