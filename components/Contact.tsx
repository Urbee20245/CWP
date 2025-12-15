import React, { useState } from 'react';
import { Mail, Phone, Send, ArrowRight, MapPin, Clock } from 'lucide-react';
import { NavigationLink } from '../types';

const Contact: React.FC = () => {
    const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('sending');
        setTimeout(() => setFormStatus('success'), 1500);
    };

  return (
    <section id={NavigationLink.Contact} className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif text-slate-900 mb-4">Start your transformation.</h2>
            <p className="text-slate-500 max-w-lg mx-auto">We take on a limited number of local clients per quarter to ensure premium service quality.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            
            {/* Left Column: Direct Contact & Info */}
            <div className="lg:col-span-5 space-y-6">
                
                {/* Primary Call Card - High Visibility */}
                <a href="tel:4045520926" className="group block p-8 rounded-2xl bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/20 transition-colors"></div>
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Priority Line</div>
                            <h3 className="text-3xl font-bold mb-1">(404) 552-0926</h3>
                            <p className="text-slate-400 text-sm">Speak directly with a strategist.</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                            <Phone className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </a>

                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <MapPin className="w-5 h-5 text-indigo-600 mt-1" />
                            <div>
                                <h4 className="font-bold text-slate-900">Local HQ</h4>
                                <p className="text-slate-500 text-sm">Loganville, GA 30052<br/>Serving Gwinnett & Walton County</p>
                            </div>
                        </div>
                        <div className="w-full h-px bg-slate-200"></div>
                        <div className="flex items-start gap-4">
                            <Clock className="w-5 h-5 text-emerald-500 mt-1" />
                            <div>
                                <h4 className="font-bold text-slate-900">Hours</h4>
                                <p className="text-slate-500 text-sm">Mon - Fri: 9am - 6pm<br/>AI Agent: 24/7 Support</p>
                            </div>
                        </div>
                        <div className="w-full h-px bg-slate-200"></div>
                        <div className="flex items-start gap-4">
                            <Mail className="w-5 h-5 text-indigo-600 mt-1" />
                            <div>
                                <h4 className="font-bold text-slate-900">Email</h4>
                                <a href="mailto:hello@customwebsitesplus.com" className="text-slate-500 text-sm hover:text-indigo-600 transition-colors">hello@customwebsitesplus.com</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Form */}
            <div className="lg:col-span-7">
                <div className="bg-white p-8 md:p-10 rounded-2xl shadow-lg border border-slate-100">
                    {formStatus === 'success' ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 border border-emerald-100">
                                <Send className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-serif text-slate-900">Message Received</h3>
                            <p className="text-slate-500 mt-2">We'll be in touch shortly to schedule your demo.</p>
                            <button 
                                onClick={() => setFormStatus('idle')}
                                className="mt-8 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">Name</label>
                                    <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">Phone</label>
                                    <input required type="tel" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all" placeholder="(555) 123-4567" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">Email Address</label>
                                <input required type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all" placeholder="john@company.com" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">I'm interested in...</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all cursor-pointer">
                                    <option>New Website Build</option>
                                    <option>AI Voice Agent Integration</option>
                                    <option>Local SEO / Google Maps</option>
                                    <option>Full Digital Overhaul</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">Project Details</label>
                                <textarea required rows={4} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all resize-none" placeholder="Tell us about your goals..."></textarea>
                            </div>

                            <button 
                                disabled={formStatus === 'sending'}
                                type="submit" 
                                className="w-full px-8 py-4 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {formStatus === 'sending' ? (
                                    'Processing...'
                                ) : (
                                    <>
                                        Request Consultation
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                            <p className="text-center text-xs text-slate-400 mt-4">No commitment required. We value your privacy.</p>
                        </form>
                    )}
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;