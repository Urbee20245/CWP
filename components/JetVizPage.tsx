import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Eye, 
  Layout, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Palette,
  Zap,
  ShieldCheck, 
  TrendingUp, 
  Globe,
  Sparkles,
  Layers,
  Phone,
  Star,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { JetViz as JetVizAnalyzer } from '../src/tools/jetviz';

const JetVizPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  
  // Slider Logic
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

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setShowAnalyzer(true);
    // Scroll to analyzer after state updates
    setTimeout(() => {
      document.getElementById('analyzer-tool')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] font-sans text-white selection:bg-indigo-500 selection:text-white">
      
      {/* Studio Navigation */}
      <nav className="sticky top-0 z-50 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                    <span className="font-bold text-xl tracking-tight block leading-none">JetViz</span>
                    <span className="text-[10px] text-indigo-300 font-medium tracking-widest uppercase">Visual Engine</span>
                </div>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium">
                <Link to="/" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all text-xs font-bold tracking-wide text-slate-300 hover:text-white hover:border-indigo-500/30">
                    Exit Studio
                </Link>
            </div>
        </div>
      </nav>

      {/* 1. Immersive Hero */}
      <header className="relative pt-20 pb-32 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[500px] bg-indigo-600/20 rounded-full blur-[150px] -z-10 pointer-events-none mix-blend-screen"></div>
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-200 text-xs font-bold uppercase tracking-widest mb-10 backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-yellow-300" />
                <span>The 0.05 Second Test</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-8 leading-[1.1] tracking-tight max-w-5xl mx-auto text-white">
                Most websites fail before SEO matters — <br className="hidden md:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-violet-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">because they look outdated.</span>
            </h1>
            
            <p className="text-slate-400 text-lg md:text-xl mb-16 max-w-2xl mx-auto leading-relaxed font-light">
                JetViz is an instant visual engine that checks your site against 2025 design standards. 
                Drag the slider to see the difference modernity makes.
            </p>

            {/* THE SLIDER COMPONENT (Cinematic) */}
            <div className="max-w-6xl mx-auto relative group mb-12 animate-fade-in-up">
                {/* Frame */}
                <div 
                  className="relative w-full aspect-[16/10] md:aspect-[21/9] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-ew-resize select-none"
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onTouchMove={handleTouchMove}
                >
                    {/* RIGHT (OLD) */}
                    <div className="absolute inset-0 bg-[#f0f0f0] flex flex-col items-center justify-center font-serif text-slate-800">
                        <div className="absolute inset-0 bg-[#d4d1cb] flex flex-col" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
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
                             <div className="absolute top-6 right-6 bg-red-600 text-white px-5 py-3 rounded-lg shadow-2xl shadow-red-900/50 ring-2 ring-red-500/50 flex items-center gap-2 z-20 font-sans backdrop-blur-sm">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-bold text-sm uppercase tracking-wider">Outdated Design</span>
                             </div>
                        </div>
                    </div>

                    {/* LEFT (NEW) - CLIPPED */}
                    <div 
                        className="absolute inset-0 bg-slate-900 flex flex-col font-sans"
                        style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
                    >
                         {/* Background Image with Gradient */}
                         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1584622050111-993a426fbf0a?auto=format&fit=crop&q=80')] bg-cover bg-center">
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-indigo-950/80 to-slate-900/60 mix-blend-multiply"></div>
                         </div>

                         {/* Modern Transparent Header */}
                         <div className="relative z-20 px-6 py-4 flex justify-between items-center border-b border-white/5 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">GP</div>
                                <span className="font-bold text-white tracking-tight">Gwinnett Plumbing</span>
                            </div>
                            <div className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
                                <span className="text-white cursor-pointer font-semibold">Home</span>
                                <span className="hover:text-white cursor-pointer transition-colors">Emergency Service</span>
                                <span className="hover:text-white cursor-pointer transition-colors">Reviews</span>
                            </div>
                            <button className="bg-white/10 backdrop-blur-md text-white border border-white/10 px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-white/20 transition-all">
                                <Phone className="w-4 h-4" />
                                (404) 555-0123
                            </button>
                         </div>

                         {/* Modern Hero Content - Glass Card */}
                         <div className="flex-1 relative flex items-center px-8 md:px-12 z-10">
                             <div className="max-w-xl bg-slate-900/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                                 <div className="flex gap-1 mb-4">
                                    {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                                    <span className="text-white text-xs ml-2 font-medium bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm">500+ 5-Star Reviews</span>
                                 </div>
                                 <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight drop-shadow-sm">
                                     24/7 Emergency Plumbing<br/>
                                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">in Gwinnett County.</span>
                                 </h1>
                                 <p className="text-slate-200 text-sm md:text-base mb-8 leading-relaxed font-medium">
                                     Technicians at your door in 60 minutes. Upfront pricing, no hidden fees, and 100% satisfaction guaranteed.
                                 </p>
                                 <div className="flex gap-3">
                                     <button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/40 hover:scale-105 transition-transform">
                                         Get Help Now
                                     </button>
                                     <button className="bg-white/5 backdrop-blur text-white border border-white/10 px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/10 transition-colors">
                                         See Pricing
                                     </button>
                                 </div>
                             </div>

                             {/* Trust Badge Overlay - Floating */}
                             <div className="absolute bottom-8 right-8 bg-white/10 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-xl hidden md:flex items-center gap-3 animate-fade-in-up">
                                 <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                     <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                 </div>
                                 <div>
                                     <div className="text-xs text-emerald-200 font-bold uppercase tracking-wide">Next Available Tech</div>
                                     <div className="text-sm font-bold text-white">14 Minutes Away</div>
                                 </div>
                             </div>
                         </div>

                         {/* Success Overlay */}
                         <div className="absolute top-6 left-6 bg-emerald-600 text-white px-5 py-3 rounded-full shadow-[0_0_25px_rgba(5,150,105,0.6)] border border-emerald-400/30 flex items-center gap-2 z-20">
                            <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />
                            <span className="font-bold text-sm tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Conversion Optimized</span>
                         </div>
                    </div>

                    {/* Drag Handle */}
                    <div 
                        className="absolute top-0 bottom-0 w-[2px] bg-white cursor-ew-resize z-30 shadow-[0_0_40px_rgba(255,255,255,0.8)]"
                        style={{ left: `${sliderPosition}%` }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center text-white border border-white/50 transition-transform hover:scale-110">
                            <ArrowLeftRight className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between mt-6 text-xs font-bold uppercase tracking-widest text-slate-500 px-2">
                    <span className="text-indigo-400">Future State</span>
                    <span className="text-slate-600">Current State</span>
                </div>
            </div>

            <button 
                onClick={() => document.getElementById('analyze-cta')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-white text-black px-10 py-5 rounded-full font-bold hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] inline-flex items-center gap-3 group text-lg"
            >
                Run Free Visual Check
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </header>

      {/* 2. Visual Pillars (Glass Cards) */}
      <section className="py-32 bg-[#0B0F19] relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05)_0%,transparent_50%)]"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-serif">The 4 Pillars of Visual Trust</h2>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                    We evaluate the subconscious signals your website sends to visitors.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                        <Palette className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Aesthetic</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Detects obsolete color schemes and typography that scream "2010".
                    </p>
                </div>

                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <Layout className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Structure</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Evaluates whitespace, hierarchy, and density for modern readability.
                    </p>
                </div>

                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 text-amber-400 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                        <Smartphone className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Mobile Flow</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Checks if buttons are thumb-friendly and if layouts adapt or break.
                    </p>
                </div>

                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Credibility</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Scans for authority signals like badges, real photography, and reviews.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* 3. Psychology Section (Darker) */}
      <section className="py-32 bg-black border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div>
                     <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 font-serif leading-tight">
                        Design is not just vanity.<br/>
                        <span className="text-slate-500">It's business economics.</span>
                     </h2>
                     <div className="space-y-10">
                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-full border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-white mb-2">The "Blink" Test</h4>
                                <p className="text-slate-400 leading-relaxed">
                                    Users form an opinion in 0.05 seconds. If that flash judgment is "outdated," they bounce before reading a single word of your copy.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-full border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-white mb-2">Trust = Revenue</h4>
                                <p className="text-slate-400 leading-relaxed">
                                    Design is the #1 proxy for competence. High-value clients assume that a cheap-looking website means a cheap-quality service.
                                </p>
                            </div>
                        </div>
                     </div>
                </div>
                
                {/* Visual Abstract */}
                <div className="relative">
                     <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 blur-3xl rounded-full"></div>
                     <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
                         <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                             <div className="h-3 w-3 rounded-full bg-red-500"></div>
                             <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                             <div className="h-3 w-3 rounded-full bg-green-500"></div>
                         </div>
                         <div className="space-y-6">
                             <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                 <span className="text-slate-300">Conversion Rate (Old)</span>
                                 <span className="text-red-400 font-mono">0.8%</span>
                             </div>
                             <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                 <span className="text-white font-bold">Conversion Rate (New)</span>
                                 <span className="text-emerald-400 font-mono font-bold">4.2%</span>
                             </div>
                         </div>
                     </div>
                </div>
            </div>
        </div>
      </section>

      {/* 4. Workflow Section */}
      <section className="py-32 bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-serif">What Happens Next?</h2>
                <p className="text-slate-400 text-lg">We don't just critique. We create.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                {/* Connector Line */}
                <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>

                <div className="relative flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-[#0B0F19] border-4 border-indigo-500/20 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <span className="text-3xl font-bold text-indigo-400">1</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Visual Score</h3>
                    <p className="text-slate-400 text-sm max-w-xs">Get a clear grade (A-F) based on modern design heuristics.</p>
                </div>

                <div className="relative flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-[#0B0F19] border-4 border-white/10 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <span className="text-3xl font-bold text-white">2</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Future Mockup</h3>
                    <p className="text-slate-400 text-sm max-w-xs">See a "Before & After" preview of what your hero section could look like.</p>
                </div>

                <div className="relative flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-[#0B0F19] border-4 border-white/10 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <span className="text-3xl font-bold text-white">3</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Technical Audit</h3>
                    <p className="text-slate-400 text-sm max-w-xs">
                        Optional: Upgrade to our <span className="text-indigo-400">Jet Optimizer</span> for a deep code inspection.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* 5. CTA Section (Center Stage) */}
      <section id="analyze-cta" className="py-32 relative overflow-hidden text-center">
        {/* Cinematic Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto px-6 relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 font-serif">See your website's future.</h2>
            
            <div className="bg-white/5 border border-white/10 p-2 rounded-[2rem] backdrop-blur-xl max-w-2xl mx-auto shadow-2xl">
                <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2">
                    <input 
                        type="url" 
                        required
                        placeholder="https://www.yourbusiness.com" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="flex-grow px-8 py-5 bg-transparent text-white placeholder-slate-500 outline-none text-lg rounded-xl"
                    />
                    <button 
                        type="submit"
                        className="whitespace-nowrap bg-white text-black px-8 py-5 rounded-2xl font-bold hover:bg-slate-200 transition-all shadow-lg flex items-center justify-center gap-2 group text-lg"
                    >
                        <>
                            Visualize Now
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    </button>
                </form>
            </div>

            <div className="mt-10 flex justify-center gap-8 text-xs text-slate-500 font-bold uppercase tracking-widest">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Free</span>
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> No Login</span>
            </div>
        </div>
      </section>

      {/* Analyzer Tool Section */}
      {showAnalyzer && (
        <section id="analyzer-tool" className="py-12 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6">
            <JetVizAnalyzer />
          </div>
        </section>
      )}

      <footer className="py-12 border-t border-white/5 bg-black text-center text-slate-600 text-sm">
        <p>&copy; 2025 Custom Websites Plus. JetViz Technology.</p>
      </footer>

    </div>
  );
};

export default JetVizPage;