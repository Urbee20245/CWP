import React from 'react';
import { ArrowRight, Star, ArrowUpRight } from 'lucide-react';
import { NavigationLink } from '../types';

const Hero: React.FC = () => {
    const scrollToContact = () => {
        document.getElementById(NavigationLink.Contact)?.scrollIntoView({ behavior: 'smooth' });
    };

    const scrollToServices = () => {
        document.getElementById(NavigationLink.Services)?.scrollIntoView({ behavior: 'smooth' });
    };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-20 overflow-hidden">
      {/* Refined Gradient Background */}
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-60"></div>
      
      {/* Sophisticated Aurora Blobs (Deeper Colors) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob"></div>
      <div className="absolute top-[10%] right-[-10%] w-[35rem] h-[35rem] bg-blue-500/20 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[45rem] h-[45rem] bg-violet-500/10 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob animation-delay-4000"></div>

      <div className="relative max-w-7xl mx-auto px-6 flex flex-col items-center text-center z-10">
        
        {/* Minimalist Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-slate-200/50 backdrop-blur-md text-slate-600 text-xs font-semibold mb-8 shadow-sm hover:shadow-md transition-all cursor-default tracking-wide uppercase font-sans">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Bookings Open for 2026
        </div>

        {/* Headlines - Playfair Display Font */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium text-slate-900 tracking-tight leading-[1.1] mb-8 max-w-6xl mx-auto">
          Websites with <br/>
          <span className="italic bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700">
            Intelligent Voice Agents.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed font-normal font-sans">
          We engineer digital experiences that work as hard as you do. 
          Combine aesthetic perfection with AI employees that handle your calls 24/7.
        </p>

        {/* Modern CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto font-sans">
          <button 
            onClick={scrollToContact}
            className="group relative w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-full font-semibold overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-slate-900/20 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-center gap-2">
                Start a Project
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
          
          <button 
            onClick={scrollToServices}
            className="group w-full sm:w-auto px-8 py-4 bg-white/80 backdrop-blur-sm text-slate-600 border border-slate-200 rounded-full font-semibold hover:bg-white hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            Explore Solutions
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </button>
        </div>

        {/* Minimal Social Proof */}
        <div className="mt-20 pt-8 border-t border-slate-200 w-full max-w-screen-lg flex flex-col md:flex-row items-center justify-between gap-8 opacity-90 font-sans">
            <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-[3px] border-[#FAFAFA] bg-slate-200 overflow-hidden shadow-sm">
                            <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${i+5}`} alt="avatar" />
                        </div>
                    ))}
                </div>
                <div className="text-left">
                    <div className="flex text-amber-400 mb-1">
                        {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trusted by 100+ Clients</p>
                </div>
            </div>
            
            <div className="flex items-center gap-12 grayscale opacity-50 mix-blend-multiply">
                 <span className="font-bold text-xl text-slate-900 tracking-tighter">Gwinnett<span className="font-light">Clinic</span></span>
                 <span className="font-bold text-xl text-slate-900 tracking-tighter">Walton<span className="italic font-serif">HVAC</span></span>
                 <span className="font-bold text-xl text-slate-900 tracking-tighter">Peach<span className="text-slate-500">State</span></span>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;