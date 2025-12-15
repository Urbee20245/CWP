import React from 'react';
import { Globe, Cpu, BarChart3, Search, ArrowRight, Zap, Database } from 'lucide-react';
import { Service, NavigationLink } from '../types';

const Services: React.FC = () => {
  const services: Service[] = [
    {
      id: 'rebuild',
      title: 'Website Rebuilds',
      description: 'We replace clunky DIY builders with custom-coded sites. No bloat, just clean code that Google prefers.',
      icon: Globe,
    },
    {
      id: 'seo',
      title: 'Local SEO Foundation',
      description: 'We implement the technical schema, sitemaps, and local signals required to rank in Gwinnett & Walton County.',
      icon: Search,
    },
    {
      id: 'speed',
      title: 'Performance Optimization',
      description: 'Speed is a ranking factor. We aim for sub-second load times and 90+ Core Web Vitals scores.',
      icon: Zap,
    },
    {
      id: 'ai',
      title: 'AI Voice Agents (Upgrade)',
      description: 'Optional 24/7 phone answering. Capture missed calls and book appointments automatically.',
      icon: Cpu,
    },
  ];

  return (
    <section id={NavigationLink.Services} className="py-24 relative bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8 border-b border-slate-100 pb-12">
            <div className="max-w-3xl">
                <span className="text-indigo-600 font-bold text-xs tracking-[0.2em] uppercase mb-4 block">Core Services</span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                   A complete digital infrastructure<br/>
                   <span className="text-slate-400">for local business.</span>
                </h2>
            </div>
            <p className="text-slate-500 max-w-sm text-base leading-relaxed font-medium">
                We focus on the four technical pillars that drive actual revenue: Structure, Speed, Visibility, and Automation.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {services.map((service) => (
            <div 
                key={service.id}
                className="group relative p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 flex flex-col h-full"
            >
                <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <service.icon className="w-6 h-6 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">{service.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-grow">
                    {service.description}
                </p>
            </div>
          ))}
        </div>

        {/* Automation Readiness Strip */}
        <div className="rounded-2xl bg-indigo-900 text-white p-8 md:p-12 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             
             <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="p-4 bg-white/10 rounded-xl">
                    <Database className="w-8 h-8 text-indigo-300" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">Included: Automation Readiness</h3>
                    <p className="text-indigo-200 text-sm leading-relaxed max-w-2xl">
                        Every site we build is "API-ready." This means we can connect your contact forms directly to your CRM, email marketing tools, or slack channels, ensuring you never have to copy-paste lead data again.
                    </p>
                </div>
                <button className="whitespace-nowrap px-6 py-3 bg-white text-indigo-900 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors">
                    Explore Automation
                </button>
             </div>
        </div>
      </div>
    </section>
  );
};

export default Services;