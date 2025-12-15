import React from 'react';
import { AlertTriangle, TrendingDown, Clock, CheckCircle2, Zap, Search, Bot, Layers, Smartphone } from 'lucide-react';

const ProblemSolution: React.FC = () => {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
        {/* Section 1: The Diagnostic */}
        <div className="max-w-7xl mx-auto px-6 mb-32">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-red-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block">The Diagnostic</span>
                <h2 className="text-4xl md:text-5xl font-serif text-slate-900 mb-6">Is your website costing you local rankings?</h2>
                <p className="text-slate-500 text-lg leading-relaxed">
                    Most local business websites were built for the desktop era. Today, they are often the bottleneck in your sales process.
                    Here are three ways an outdated site actively loses you money.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Problem 1: Visibility */}
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:border-red-200 transition-colors">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-6 text-red-500">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Invisible to Search</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Google now penalizes slow, clunky sites. If your code is bloated or outdated, search engines struggle to read it, pushing you down the list below competitors.
                    </p>
                </div>
                 {/* Problem 2: Speed */}
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:border-red-200 transition-colors">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-6 text-red-500">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Mobile Abandonment</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Over 60% of local searches happen on phones. If your site takes more than 3 seconds to load, 53% of potential customers will hit "Back" and call the next number.
                    </p>
                </div>
                 {/* Problem 3: Trust */}
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:border-red-200 transition-colors">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-6 text-red-500">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">The "Trust Gap"</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        A broken or dated design signals "out of business" or "low quality." You might be the best in town, but your website is telling high-value clients otherwise.
                    </p>
                </div>
            </div>
        </div>

        {/* Section 2: How We Fix It */}
        <div className="bg-slate-900 py-24 -mx-6 md:mx-4 md:rounded-[3rem] relative overflow-hidden">
             {/* Background noise/grid */}
             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
             
             <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <span className="text-emerald-400 font-bold text-xs tracking-[0.2em] uppercase mb-4 block">The Solution</span>
                        <h2 className="text-4xl md:text-5xl font-serif text-white mb-6">How We Fix It</h2>
                        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                            We don't try to fix a crumbling house with a fresh coat of paint. We rebuild the foundation using modern technology designed for growth.
                        </p>
                        
                        <div className="space-y-8">
                            <div className="flex gap-4">
                                <div className="mt-1 flex-shrink-0"><Layers className="w-6 h-6 text-emerald-500" /></div>
                                <div>
                                    <h4 className="text-white font-bold text-lg">Clean Website Rebuild</h4>
                                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                                        We move you away from bloated DIY builders. We write clean, lightweight code that loads instantly and works perfectly on every device.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="mt-1 flex-shrink-0"><Search className="w-6 h-6 text-emerald-500" /></div>
                                <div>
                                    <h4 className="text-white font-bold text-lg">Local SEO Foundation</h4>
                                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                                        We bake your location, service areas, and industry keywords directly into the site structure, making it easy for Google to verify your business.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="mt-1 flex-shrink-0"><Bot className="w-6 h-6 text-emerald-500" /></div>
                                <div>
                                    <h4 className="text-white font-bold text-lg">AI-Ready Infrastructure</h4>
                                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                                        Once your site is fast and visible, we layer on AI automation—like voice agents and chat—to ensure you never miss a lead that your new site generates.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Visual: The Stack */}
                    <div className="relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
                             <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4">
                                <span className="text-slate-400 font-mono text-xs uppercase">Your New Engine</span>
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                                    <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                                </div>
                             </div>

                             {/* Abstract visual of 'layers' */}
                             <div className="space-y-4">
                                 {/* Layer 3 */}
                                 <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-4">
                                     <div className="p-2 bg-emerald-500/20 rounded-lg"><Bot className="w-5 h-5 text-emerald-400"/></div>
                                     <div>
                                        <span className="text-emerald-100 font-bold block text-sm">Layer 3: The Advantage</span>
                                        <span className="text-emerald-400/60 text-xs">AI Agents & Automation</span>
                                     </div>
                                 </div>
                                 
                                 {/* Layer 2 */}
                                 <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-4">
                                     <div className="p-2 bg-indigo-500/20 rounded-lg"><Search className="w-5 h-5 text-indigo-400"/></div>
                                     <div>
                                        <span className="text-indigo-100 font-bold block text-sm">Layer 2: The Traffic</span>
                                        <span className="text-indigo-400/60 text-xs">Local SEO & Schema Data</span>
                                     </div>
                                 </div>

                                 {/* Layer 1 */}
                                 <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-xl flex items-center gap-4">
                                     <div className="p-2 bg-slate-600 rounded-lg"><Layers className="w-5 h-5 text-slate-300"/></div>
                                     <div>
                                        <span className="text-slate-200 font-bold block text-sm">Layer 1: The Foundation</span>
                                        <span className="text-slate-500 text-xs">Performance Architecture</span>
                                     </div>
                                 </div>
                             </div>

                             <div className="mt-8 pt-8 border-t border-slate-700 text-center">
                                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-green-400 text-xs font-bold uppercase">System: Optimized</span>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
             </div>
        </div>
    </section>
  );
};

export default ProblemSolution;