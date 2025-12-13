import React from 'react';
import { MessageSquare, PenTool, CheckCircle, Rocket } from 'lucide-react';
import { NavigationLink } from '../types';

const Process: React.FC = () => {
  const steps = [
    { icon: MessageSquare, title: "Consultation", desc: "We map out your goals." },
    { icon: PenTool, title: "Design & Build", desc: "We create your digital asset." },
    { icon: CheckCircle, title: "Refinement", desc: "You review, we polish." },
    { icon: Rocket, title: "Launch", desc: "Go live and grow." }
  ];

  return (
    <section id={NavigationLink.Process} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight">How We Work</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {steps.map((step, idx) => (
                <div key={idx} className="relative flex flex-col items-center text-center group">
                    {/* Connector Line */}
                    {idx !== steps.length - 1 && (
                        <div className="hidden md:block absolute top-10 left-1/2 w-full h-[2px] bg-slate-100 z-0">
                            <div className="h-full bg-blue-600 w-0 group-hover:w-full transition-all duration-700 ease-out"></div>
                        </div>
                    )}
                    
                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-6 z-10 shadow-sm group-hover:border-blue-500 group-hover:shadow-blue-200 group-hover:shadow-lg transition-all duration-300">
                        <step.icon className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default Process;