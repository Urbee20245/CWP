import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, Gauge, Eye, Phone, ArrowRight, Sparkles, LogIn } from 'lucide-react';
import { NavigationLink } from '../types';
import { Link } from 'react-router-dom';
import { useModal } from '../src/context/ModalProvider'; // New Import

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const { openLoginModal } = useModal(); // Use Modal Context

  // Handle scroll effect for background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll handler
  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    setIsToolsOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 md:pt-6">
      <div 
        className={`
          w-full max-w-6xl transition-all duration-300 ease-in-out rounded-full px-6 py-3 
          flex justify-between items-center
          ${isScrolled 
            ? 'bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/5' 
            : 'bg-white/40 backdrop-blur-sm border border-white/10'
          }
        `}
      >
        {/* Logo Area */}
        <Link to="/" className="flex items-center gap-2 cursor-pointer">
           <img 
            src="/CWPlogolight.png" 
            alt="Custom Websites Plus" 
            className="h-10 md:h-14 w-auto object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/services"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-full transition-all"
          >
            Services
          </Link>

          <Link
            to="/jetsuite"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-full transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            JetSuite
          </Link>

          {/* Tools Dropdown Container */}
          <div 
            className="relative"
            onMouseEnter={() => setIsToolsOpen(true)}
            onMouseLeave={() => setIsToolsOpen(false)}
          >
            <button 
                className={`
                    px-5 py-2.5 text-sm font-medium rounded-full transition-all flex items-center gap-1.5
                    ${isToolsOpen ? 'text-slate-900 bg-white/50' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}
                `}
            >
                Tools 
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown Menu */}
            <div 
                className={`
                    absolute top-full left-1/2 -translate-x-1/2 pt-4 w-80 
                    transition-all duration-200 origin-top
                    ${isToolsOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-2 invisible'}
                `}
            >
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-2 overflow-hidden ring-1 ring-black/5">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                        Free Utilities
                    </div>
                    <Link 
                        to="/jet-local-optimizer"
                        onClick={() => setIsToolsOpen(false)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group/item"
                    >
                        <div className="mt-1 bg-indigo-50 p-2 rounded-lg text-indigo-600 group-hover/item:bg-indigo-100 transition-colors">
                            <Gauge className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900 group-hover/item:text-indigo-700 transition-colors">Jet Optimizer</div>
                            <div className="text-xs text-slate-500 leading-tight mt-0.5">Technical website audit & health check.</div>
                        </div>
                    </Link>
                    <Link 
                        to="/jetviz"
                        onClick={() => setIsToolsOpen(false)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group/item"
                    >
                        <div className="mt-1 bg-purple-50 p-2 rounded-lg text-purple-600 group-hover/item:bg-purple-100 transition-colors">
                            <Eye className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900 group-hover/item:text-purple-700 transition-colors">JetViz</div>
                            <div className="text-xs text-slate-500 leading-tight mt-0.5">Instant visual design comparison.</div>
                        </div>
                    </Link>
                    <Link 
                        to="/jetsuite"
                        onClick={() => setIsToolsOpen(false)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group/item"
                    >
                        <div className="mt-1 bg-emerald-50 p-2 rounded-lg text-emerald-600 group-hover/item:bg-emerald-100 transition-colors">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900 group-hover/item:text-emerald-700 transition-colors">JetSuite</div>
                            <div className="text-xs text-slate-500 leading-tight mt-0.5">The complete agency operating system.</div>
                        </div>
                    </Link>
                </div>
            </div>
          </div>

          <Link
            to="/process"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-full transition-all"
          >
            Process
          </Link>
          
          <Link
            to="/contact"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-full transition-all"
          >
            Contact
          </Link>
        </nav>

        {/* Right Side Actions (Run Website Audit CTA) */}
        <div className="hidden md:flex items-center gap-4 pl-4 border-l border-slate-200 ml-2">
             <a 
                href="tel:4045520926" 
                className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-2"
             >
                <Phone className="w-4 h-4" />
                <span className="hidden lg:inline">(404) 552-0926</span>
             </a>
             <Link
                to="/jet-local-optimizer" 
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center gap-2"
             >
                <Gauge className="w-4 h-4" />
                Run Website Audit
             </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-slate-900 hover:bg-white/50 rounded-full transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="absolute top-24 left-4 right-4 z-40 md:hidden">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-2 shadow-2xl border border-white/20 animate-fade-in-up ring-1 ring-black/5">
                <div className="p-4 space-y-1">
                    <Link
                      to="/services"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold"
                    >
                      Services
                    </Link>
                    <Link
                      to="/jetsuite"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      JetSuite
                    </Link>
                    <Link
                      to="/process"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold"
                    >
                      Process
                    </Link>
                    <Link
                      to="/contact"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold"
                    >
                      Contact
                    </Link>
                    
                    {/* Portal Login Link */}
                    <button
                      onClick={() => { setIsMobileMenuOpen(false); openLoginModal(); }}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2"
                    >
                      <LogIn className="w-4 h-4 text-slate-500" />
                      Client Portal Login
                    </button>
                </div>
                
                {/* Mobile Tools Block */}
                <div className="mx-2 bg-slate-50 rounded-2xl p-4 mb-2 border border-slate-100">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Free Tools</div>
                   <div className="space-y-2">
                       <Link 
                           to="/jet-local-optimizer"
                           onClick={() => setIsMobileMenuOpen(false)}
                           className="w-full text-left p-3 rounded-xl bg-white border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-transform"
                       >
                          <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Gauge className="w-5 h-5" /></div>
                          <div>
                              <div className="text-sm font-bold text-slate-900">Jet Local Optimizer</div>
                              <div className="text-xs text-slate-500">Technical Website Audit</div>
                          </div>
                       </Link>
                       <Link 
                           to="/jetviz"
                           onClick={() => setIsMobileMenuOpen(false)}
                           className="w-full text-left p-3 rounded-xl bg-white border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-transform"
                       >
                          <div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Eye className="w-5 h-5" /></div>
                          <div>
                              <div className="text-sm font-bold text-slate-900">JetViz</div>
                              <div className="text-xs text-slate-500">Visual Website Check</div>
                          </div>
                       </Link>
                   </div>
                </div>

                <div className="p-2">
                    <Link
                      to="/jet-local-optimizer"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full bg-indigo-600 text-white px-4 py-4 rounded-2xl font-bold shadow-lg flex justify-center items-center gap-2"
                    >
                      <Gauge className="w-4 h-4" />
                      Run Website Audit
                    </Link>
                </div>
            </div>
        </div>
      )}
    </header>
  );
};

export default Header;