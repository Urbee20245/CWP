import React from 'react';
import { Globe, Cpu, Megaphone, Search, ArrowRight } from 'lucide-react';
import { Service, NavigationLink } from '../types';

const Services: React.FC = () => {
  const services: Service[] = [
    {
      id: 'web',
      title: 'AI-Native Web Design',
      description: 'Sophisticated interfaces designed to host your digital workforce.',
      icon: Globe,
    },
    {
      id: 'ai',
      title: 'Voice Intelligence',
      description: 'Deploy 24/7 AI agents that handle booking, support, and sales inquiries seamlessly.',
      icon: Cpu,
    },
    {
      id: 'marketing',
      title: 'Growth Automation',
      description: 'End-to-end marketing workflows that nurture leads without human intervention.',
      icon: Megaphone,
    },
    {
      id: 'seo',
      title: 'Precision SEO',
      description: 'Data-driven strategies to dominate local search results in Gwinnett & Walton County.',
      icon: Search,
    },
  ];

  return (
    <section id={NavigationLink.Services} className="py-32 relative bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8 border-b border-slate-100 pb-12">
            <div className="max-w-3xl">
                <span className="text-indigo-600 font-bold text-xs tracking-[0.2em] uppercase mb-4 block">Our Expertise</span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                    Beyond traditional websites.<br/>
                    <span className="text-slate-400">We build revenue engines.</span>
                </h2>
            </div>
            <p className="text-slate-500 max-w-sm text-base leading-relaxed font-medium">
                Marrying minimalist aesthetics with maximalist functionality. Every pixel serves a purpose.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, idx) => (
            <div 
                key={service.id}
                className="group relative p-8 rounded-3xl bg-white border border-slate-100 hover:border-indigo-100 transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.1)] hover:-translate-y-2 flex flex-col justify-between h-[22rem]"
            >
                {/* Gradient background overlay on hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-transparent via-transparent to-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-8 shadow-sm group-hover:shadow-md group-hover:scale-110 group-hover:bg-white transition-all duration-500 ease-out">
                        <service.icon className="w-6 h-6 text-slate-500 group-hover:text-indigo-600 transition-colors duration-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight group-hover:text-indigo-900 transition-colors duration-500">{service.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed group-hover:text-slate-600 transition-colors duration-500">
                        {service.description}
                    </p>
                </div>

                <div className="relative z-10 flex items-center text-indigo-600 font-semibold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
                    Learn more <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;