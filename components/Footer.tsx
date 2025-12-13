import React from 'react';
import { Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div className="mb-6 md:mb-0">
                <img 
                  src="https://customwebsitesplus.com/wp-content/uploads/2019/01/CWPtrans.png" 
                  alt="Custom Websites Plus" 
                  className="h-12 w-auto mb-4 object-contain"
                />
                <p className="text-slate-400 text-sm mt-2">
                    © 2025 Custom Websites Plus. All rights reserved.
                </p>
            </div>
            
            <div className="flex gap-6">
                <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="text-slate-400 hover:text-pink-600 transition-colors"><Instagram className="w-5 h-5" /></a>
                <a href="#" className="text-slate-400 hover:text-blue-400 transition-colors"><Twitter className="w-5 h-5" /></a>
                <a href="#" className="text-slate-400 hover:text-blue-700 transition-colors"><Linkedin className="w-5 h-5" /></a>
            </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-center gap-8 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-900">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900">Terms of Service</a>
            <a href="#" className="hover:text-slate-900">Sitemap</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;