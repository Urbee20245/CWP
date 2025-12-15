import React from 'react';

const Stats: React.FC = () => {
  return (
    <section className="py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto rounded-[2rem] bg-slate-900 text-white relative overflow-hidden p-12 md:p-20 shadow-2xl">
            
            {/* Architectural Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8">
                <div className="max-w-sm text-center md:text-left">
                    <h3 className="text-2xl font-serif mb-2">Results Driven.</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        We don't just build pretty pages. We focus on the metrics that actually pay your bills.
                    </p>
                </div>

                <div className="w-full md:w-auto h-px md:h-20 bg-white/10"></div>

                <div className="grid grid-cols-3 gap-8 md:gap-16 text-center">
                    <div className="flex flex-col items-center">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tight text-white">
                            300<span className="text-indigo-400">%</span>
                        </div>
                        <div className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Avg. Traffic Growth</div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tight text-white">
                            24<span className="text-emerald-400">/7</span>
                        </div>
                        <div className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Lead Capture</div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="text-4xl md:text-5xl font-bold mb-2 tracking-tight text-white">
                            5.0
                        </div>
                        <div className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Star Rating</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
  );
};

export default Stats;