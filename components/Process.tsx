import React from 'react';
import { ClipboardCheck, PenTool, Rocket, ArrowRight } from 'lucide-react';
import { NavigationLink } from '../types';

const Process: React.FC = () => {
  const steps = [
    { 
        id: 1,
        icon: ClipboardCheck, 
        title: "1. The Audit", 
        desc: "We scan your current presence, identify technical errors, and map out your local keyword strategy." 
    },
    { 
        id: 2, 
        icon: PenTool, 
        title: "2. The Build", 
        desc: "We design and code your new site on a staging server. You get full review access before we go live." 
    },
    { 
        id: 3, 
        icon: Rocket, 
        title: "3. Launch & Scale", 
        desc: "We migrate your content, set up your Google Business Profile, and hand over the keys (or handle maintenance for you)." 
    }
  ];

  return (
    <section className="py-24 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
            <span className="text-slate-500 font-bold text-xs tracking-[0.2em] uppercase mb-4 block">Our Process</span>
            <h2 className="text-3xl md:text-4xl font-serif text-slate-900">Simple 3-Step Transformation</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {steps.map((step, idx) => (
                <div key={idx} className="relative flex flex-col items-center text-center group">
                    {/* Connector Line (Desktop) */}
                    {idx !== steps.length - 1 && (
                        <div className="hidden md:block absolute top-10 left-1/2 w-full h-[2px] bg-slate-200 z-0">
                            <ArrowRight className="absolute -right-3 -top-2.5 w-6 h-6 text-slate-200 bg-slate-50" />
                        </div>
                    )}
                    
                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-6 z-10 shadow-sm relative">
                        <step.icon className="w-8 h-8 text-indigo-600" />
                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold border-4 border-slate-50">
                            {step.id}
                        </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{step.desc}</p>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default Process;