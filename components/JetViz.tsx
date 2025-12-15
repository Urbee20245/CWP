import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftRight, Phone, Star, CheckCircle2, AlertCircle, Smartphone, ShieldCheck, Layout, TrendingUp, Globe, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const JetViz: React.FC = () => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <section id="jetviz" className="py-24 bg-slate-900 overflow-hidden relative selection:bg-indigo-500 selection:text-white">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wide mb-6">
            <ArrowLeftRight className="w-3 h-3" />
            <span>JetViz Visualizer</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
            Most websites fail before SEO even matters — because they look outdated. JetViz shows you that instantly.
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Your customers judge your credibility in milliseconds. Drag the slider below to compare a typical older website against a modern design built to capture attention and build trust immediately.
          </p>
        </div>

        {/* Explanatory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="mt-1 p-2.5 rounded-xl bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
                    <Layout className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm mb-2">Outdated Designs</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">Identifies clunky, old-school layouts that signal "low quality" to new customers.</p>
                </div>
            </div>
            
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="mt-1 p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                    <Smartphone className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm mb-2">Mobile Readiness</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">Checks if your site creates friction for the 60% of traffic visiting from phones.</p>
                </div>
            </div>

            <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="mt-1 p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm mb-2">Trust Signals</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">Highlights the modern visual cues that make strangers feel safe calling you.</p>
                </div>
            </div>

            <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="mt-1 p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                    <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm mb-2">Competitor Check</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">Shows clearly if you look like a market leader or just another follower.</p>
                </div>
            </div>
        </div>

        {/* The Comparison Frame */}
        <div 
          className="relative w-full max-w-5xl mx-auto aspect-[4/3] md:aspect-[16/9] rounded-2xl overflow-hidden border-4 border-slate-700 shadow-2xl shadow-black/50 select-none group cursor-ew-resize"
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
        >
          
          {/* =======================
              RIGHT SIDE (OLD / BAD) 
              Forcing 'Times New Roman' to bypass Inter override for visual contrast
             ======================= */}
          <div className="absolute inset-0 bg-[#eae8e4] flex flex-col" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
             {/* Header */}
             <div className="bg-[#8b0000] text-white p-4 text-center">
                <h3 className="text-xl font-bold tracking-wide">GWINNETT PLUMBING INC.</h3>
                <p className="text-xs mt-1">Family Owned & Operated Since 1998</p>
             </div>
             {/* Navigation */}
             <div className="bg-[#333] text-white text-xs flex justify-center gap-4 py-2">
                <span className="underline">Home</span> | <span className="underline">About Us</span> | <span className="underline">Services</span> | <span className="underline">Contact</span>
             </div>
             {/* Hero */}
             <div className="bg-slate-300 h-64 flex items-center justify-center relative border-b-4 border-[#8b0000]">
                 <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1585747644393-25319727187b?auto=format&fit=crop&q=80')] bg-cover bg-center grayscale"></div>
                 <div className="bg-white/90 p-6 border-2 border-black text-center shadow-lg max-w-xs relative z-10">
                     <h4 className="text-black font-bold text-lg mb-2 text-red-900">Reliable Plumbing Services</h4>
                     <p className="text-xs text-black mb-4 leading-tight">We handle all your plumbing needs. No job is too big or too small. Call us for a quote.</p>
                     <button className="bg-[#ccc] border border-black px-2 py-1 text-xs text-black shadow-[2px_2px_0px_black] active:translate-y-[2px] active:shadow-none">More Info</button>
                 </div>
             </div>
             {/* Content Wall */}
             <div className="p-8 text-black bg-[#f4f4f4] flex-1 border-t border-white">
                 <h5 className="font-bold underline mb-2">Our Services</h5>
                 <p className="text-xs leading-5 max-w-md">
                    We specialize in water heaters, drain cleaning, and pipe repair for all of Gwinnett County. Our team is fully licensed and insured for your peace of mind. Call us today to schedule an appointment with our office.
                 </p>
                 <br/>
                 <p className="text-xs text-red-600 font-bold">
                    Office Hours: Mon-Fri 9am-5pm
                 </p>
             </div>
             
             {/* Warning Overlay */}
             <div className="absolute top-6 right-6 bg-red-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 z-20 font-sans">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold text-sm">Outdated Design</span>
             </div>
          </div>

          {/* =======================
              LEFT SIDE (NEW / GOOD) 
              (Clipped by slider)
             ======================= */}
          <div 
            className="absolute inset-0 bg-white flex flex-col font-sans"
            style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
          >
             {/* Modern Header */}
             <div className="bg-white px-6 py-4 flex justify-between items-center shadow-sm z-20 relative">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-md">GP</div>
                    <span className="font-bold text-slate-900 tracking-tight">Gwinnett Plumbing</span>
                </div>
                <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
                    <span className="text-indigo-600 cursor-pointer">Home</span>
                    <span className="hover:text-indigo-600 cursor-pointer transition-colors">Emergency Service</span>
                    <span className="hover:text-indigo-600 cursor-pointer transition-colors">Reviews</span>
                </div>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 hover:bg-indigo-500 transition-colors">
                    <Phone className="w-4 h-4" />
                    (404) 555-0123
                </button>
             </div>

             {/* Modern Hero */}
             <div className="flex-1 relative bg-slate-50 flex items-center">
                 <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1584622050111-993a426fbf0a?auto=format&fit=crop&q=80')] bg-cover bg-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/20"></div>
                 </div>
                 
                 <div className="relative z-10 px-8 md:px-12 w-full max-w-2xl">
                     <div className="flex gap-1 mb-4">
                        {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                        <span className="text-white text-xs ml-2 font-medium bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm">500+ 5-Star Reviews on Google</span>
                     </div>
                     <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
                         24/7 Emergency Plumbing<br/>
                         <span className="text-indigo-400">in Gwinnett County.</span>
                     </h1>
                     <p className="text-slate-300 text-sm md:text-base mb-8 max-w-md leading-relaxed font-medium">
                         Technicians at your door in 60 minutes. Upfront pricing, no hidden fees, and 100% satisfaction guaranteed.
                     </p>
                     <div className="flex gap-3">
                         <button className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 hover:bg-emerald-400 transition-colors hover:translate-y-[-1px]">
                             Get Help Now
                         </button>
                         <button className="bg-white/10 backdrop-blur text-white border border-white/20 px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-colors">
                             See Pricing
                         </button>
                     </div>
                 </div>

                 {/* Trust Badge Overlay */}
                 <div className="absolute bottom-8 right-8 bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl hidden md:flex items-center gap-3 animate-fade-in-up">
                     <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                         <CheckCircle2 className="w-6 h-6 text-green-600" />
                     </div>
                     <div>
                         <div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Next Available Tech</div>
                         <div className="text-sm font-bold text-slate-900">14 Minutes Away</div>
                     </div>
                 </div>
             </div>

             {/* Success Overlay */}
             <div className="absolute top-6 left-6 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-20 shadow-emerald-900/20">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold text-sm">Conversion Optimized</span>
             </div>
          </div>

          {/* Slider Handle */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-30 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-slate-900 transition-transform hover:scale-110">
                <ArrowLeftRight className="w-6 h-6 text-slate-900" />
            </div>
          </div>
        </div>

        {/* Labels below slider */}
        <div className="flex justify-between items-center max-w-5xl mx-auto mt-6 text-sm font-bold tracking-wide uppercase">
            <span className="text-emerald-400 flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" /> 
                Modern "Growth" Engine
            </span>
            <span className="text-red-400 flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                Old "Brochure" Site 
                <AlertCircle className="w-4 h-4" />
            </span>
        </div>

        {/* Call to Action Tool Input */}
        <div className="mt-20 max-w-3xl mx-auto">
            <div className="bg-slate-800/80 border border-slate-700/50 p-8 md:p-10 rounded-3xl backdrop-blur-md relative overflow-hidden shadow-2xl">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                
                <div className="relative z-10 text-center">
                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-3">Want to see where you stand?</h3>
                    <p className="text-slate-400 text-sm md:text-base mb-8 max-w-lg mx-auto leading-relaxed">
                        Enter your website URL below to get a quick visual assessment.
                    </p>
                    
                    <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => { e.preventDefault(); }}>
                        <div className="relative flex-grow group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Globe className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                            </div>
                            <input 
                                type="url" 
                                required
                                placeholder="https://www.yourbusiness.com" 
                                className="block w-full pl-11 pr-4 py-4 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                            />
                        </div>
                        <Link to="/jetviz" className="whitespace-nowrap bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 group active:scale-95">
                            Run Free Visual Check
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </form>

                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-slate-600" /> No login required</span>
                        <span className="hidden sm:inline text-slate-700">•</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-slate-600" /> Instant results</span>
                        <span className="hidden sm:inline text-slate-700">•</span>
                        <span>No ranking guarantees</span>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </section>
  );
};

export default JetViz;