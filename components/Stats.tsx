import React from 'react';
import { Award, Users, Star } from 'lucide-react';

const Stats: React.FC = () => {
  return (
    <section className="py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto rounded-[3rem] bg-[#0A0A0A] text-white relative overflow-hidden p-16 md:p-24 shadow-2xl">
            
            {/* Subtle Gradient Mesh */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-900/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 opacity-30"></div>
            
            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
                <div className="flex flex-col items-center group pt-8 md:pt-0">
                    <div className="text-6xl md:text-7xl font-bold mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        2017
                    </div>
                    <div className="text-slate-400 font-medium tracking-widest uppercase text-xs">Established</div>
                </div>
                <div className="flex flex-col items-center group pt-8 md:pt-0">
                    <div className="text-6xl md:text-7xl font-bold mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        5.0
                    </div>
                    <div className="text-slate-400 font-medium tracking-widest uppercase text-xs">Google Rating</div>
                </div>
                <div className="flex flex-col items-center group pt-8 md:pt-0">
                    <div className="text-6xl md:text-7xl font-bold mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        100+
                    </div>
                    <div className="text-slate-400 font-medium tracking-widest uppercase text-xs">Clients Served</div>
                </div>
            </div>
        </div>
    </section>
  );
};

export default Stats;