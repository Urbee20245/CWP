import React from 'react';
import { Briefcase, Gavel, Stethoscope, Home, Quote } from 'lucide-react';

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

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-900 text-white p-10 rounded-3xl relative overflow-hidden">
                <Quote className="absolute top-8 right-8 w-20 h-20 text-slate-800 rotate-180" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <p className="text-lg leading-relaxed font-medium mb-8">
                        "We had a 'nice' website before, but it didn't generate calls. Since the rebuild, our organic traffic is up 300% and the quality of leads is noticeably higher. The local SEO foundation really works."
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">JD</div>
                        <div>
                            <div className="font-bold">John D.</div>
                            <div className="text-slate-400 text-xs">Local HVAC Owner • Loganville, GA</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 p-10 rounded-3xl relative shadow-sm">
                 <Quote className="absolute top-8 right-8 w-20 h-20 text-slate-100 rotate-180" />
                 <div className="relative z-10 flex flex-col h-full justify-between">
                    <p className="text-lg leading-relaxed text-slate-600 font-medium mb-8">
                        "I was skeptical about the 'AI Voice Agent' at first, but it catches every call we miss after hours. It's like having a receptionist who never sleeps. Paid for itself in the first month."
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">SM</div>
                        <div>
                            <div className="font-bold text-slate-900">Sarah M.</div>
                            <div className="text-slate-500 text-xs">Real Estate Broker • Lawrenceville, GA</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-8 uppercase tracking-widest">
            * Placeholder testimonials for demonstration purposes
        </p>
      </div>
    </section>
  );
};

export default TrustAuthority;