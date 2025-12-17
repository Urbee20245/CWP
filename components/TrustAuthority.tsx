import React from 'react';
import { Briefcase, Gavel, Stethoscope, Home } from 'lucide-react';

import Testimonials from './Testimonials';

const TrustAuthority: React.FC = () => {
  const industries = [
    { icon: Home, label: "Home Services", sub: "HVAC, Plumbing, Roofing" },
    { icon: Gavel, label: "Professional", sub: "Lawyers, Accountants, Finance" },
    { icon: Stethoscope, label: "Medical", sub: "Dental, Chiro, MedSpa" },
    { icon: Briefcase, label: "Real Estate", sub: "Agents, Property Mgmt" },
  ];

  return (
    <section className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-serif text-slate-900 mb-6">
                Built for established businesses in Walton & Gwinnett County.
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
                We aren't a fit for everyone. We specialize in high-ticket service providers who rely on trust, reputation, and phone calls to grow their business.
            </p>
        </div>

        {/* Industries Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
            {industries.map((ind, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center hover:border-indigo-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 text-indigo-600 shadow-sm">
                        <ind.icon className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{ind.label}</h4>
                    <p className="text-xs text-slate-400">{ind.sub}</p>
                </div>
            ))}
        </div>
      </div>
      
      {/* Testimonials Component */}
      <Testimonials />
    </section>
  );
};

export default TrustAuthority;