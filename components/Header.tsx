import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { NavigationLink } from '../types';

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { label: 'Services', id: NavigationLink.Services },
    { label: 'Process', id: NavigationLink.Process },
    { label: 'Contact', id: NavigationLink.Contact },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <div 
        className={`w-full max-w-5xl transition-all duration-300 rounded-full px-6 py-3 flex justify-between items-center ${
            isScrolled 
            ? 'bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/5 mt-2' 
            : 'bg-transparent border border-transparent'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img 
            src="https://customwebsitesplus.com/wp-content/uploads/2019/01/CWPtrans.png" 
            alt="Custom Websites Plus" 
            className="h-8 md:h-10 w-auto object-contain"
          />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-full transition-all"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
             <a href="tel:4045520926" className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                (404) 552-0926
             </a>
             <button
                onClick={() => scrollToSection(NavigationLink.Contact)} 
                className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-800 transition-all hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
             >
                Get Started
             </button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-slate-900"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="absolute top-20 left-4 right-4 bg-white/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/20 flex flex-col gap-4 animate-fade-in-up md:hidden">
            {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className="text-lg font-semibold text-slate-800 text-left py-2 border-b border-slate-100 last:border-0"
            >
              {link.label}
            </button>
          ))}
            <button
              onClick={() => scrollToSection(NavigationLink.Contact)}
              className="mt-2 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold"
            >
              Get Started
            </button>
        </div>
      )}
    </header>
  );
};

export default Header;