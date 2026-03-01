import React, { useState, useEffect } from 'react';
import { Menu, X, Gauge, Phone, Sparkles, LogIn } from 'lucide-react';
import { NavigationLink } from '../types';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            to="/pro-sites"
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all flex items-center gap-1.5 shadow-md shadow-indigo-900/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pro Sites
          </Link>

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
                href="tel:4702646256" 
                className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-2"
             >
                <Phone className="w-4 h-4" />
                <span className="hidden lg:inline">(470) 264-6256</span>
             </a>
             <Link
                to="/jetsuite"
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
                      to="/pro-sites"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Pro Sites
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
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2"
                    >
                      <LogIn className="w-4 h-4 text-slate-500" />
                      Client Portal Login
                    </Link>
                </div>
                
                <div className="p-2">
                    <Link
                      to="/jetsuite"
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