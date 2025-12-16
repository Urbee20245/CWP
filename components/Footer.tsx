import React from 'react';
import { Facebook, Instagram, Twitter, Linkedin, MapPin, Mail, Phone } from 'lucide-react';
import { NavigationLink } from '../types';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-20 pb-10 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            
            {/* Column 1: Brand & Description */}
            <div className="col-span-1 md:col-span-1">
                <img 
                  src="/CWPlogodark.png" 
                  alt="Custom Websites Plus" 
                  className="h-12 w-auto mb-6 object-contain"
                />
                <p className="text-sm leading-relaxed text-slate-400 mb-6">
                    We help local service businesses in Georgia stop losing leads to outdated websites. We build fast, high-performance digital assets that rank locally and convert visitors into calls.
                </p>
                <div className="flex gap-4">
                    <a href="#" className="p-2 bg-slate-800 rounded-full hover:bg-indigo-600 transition-colors"><Facebook className="w-4 h-4" /></a>
                    <a href="#" className="p-2 bg-slate-800 rounded-full hover:bg-pink-600 transition-colors"><Instagram className="w-4 h-4" /></a>
                    <a href="#" className="p-2 bg-slate-800 rounded-full hover:bg-blue-500 transition-colors"><Linkedin className="w-4 h-4" /></a>
                </div>
            </div>

            {/* Column 2: Services */}
            <div>
                <h4 className="text-white font-bold mb-6">Services</h4>
                <ul className="space-y-3 text-sm">
                    <li><a href={`#${NavigationLink.Services}`} className="hover:text-indigo-400 transition-colors text-left">Website Rebuilds</a></li>
                    <li><a href="#optimizer" className="hover:text-indigo-400 transition-colors text-left">Local SEO Audits</a></li>
                    <li><a href={`#${NavigationLink.Services}`} className="hover:text-indigo-400 transition-colors text-left">AI Voice Agents</a></li>
                    <li><a href={`#${NavigationLink.Services}`} className="hover:text-indigo-400 transition-colors text-left">Google Maps Optimization</a></li>
                </ul>
            </div>

            {/* Column 3: Local Focus */}
            <div>
                <h4 className="text-white font-bold mb-6">Service Area</h4>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                    Proudly serving local business owners in Walton County, Gwinnett County, and the greater Metro Atlanta area.
                </p>
                <ul className="space-y-2 text-sm text-slate-500">
                    <li className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Loganville, GA</li>
                    <li className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Monroe, GA</li>
                    <li className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Snellville, GA</li>
                    <li className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Lawrenceville, GA</li>
                </ul>
            </div>

            {/* Column 4: Contact */}
            <div>
                <h4 className="text-white font-bold mb-6">Contact</h4>
                <ul className="space-y-4 text-sm">
                    <li className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-indigo-400 shrink-0" />
                        <a href="tel:4045520926" className="hover:text-white transition-colors">(404) 552-0926</a>
                    </li>
                    <li className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
                        <a href="mailto:hello@customwebsitesplus.com" className="hover:text-white transition-colors">hello@customwebsitesplus.com</a>
                    </li>
                    <li>
                        <div className="mt-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
                            <span className="block text-xs font-bold text-emerald-400 mb-1 uppercase">Now Accepting</span>
                            <span className="text-xs text-slate-300">New clients for Q3 2025 Rebuilds</span>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>© 2025 Custom Websites Plus. Built by <a href="https://jetautomations.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">Jetautomations.AI</a></p>
            <div className="flex gap-6">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Sitemap</a>
            </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;