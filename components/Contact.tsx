import React, { useState } from 'react';
import { Mail, Phone, Send, ArrowRight } from 'lucide-react';
import { NavigationLink } from '../types';

const Contact: React.FC = () => {
    const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('sending');
        setTimeout(() => setFormStatus('success'), 1500);
    };

  return (
    <section id={NavigationLink.Contact} className="py-32 bg-[#FAFAFA] relative">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
            
            <div className="lg:col-span-5 flex flex-col justify-center">
                <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-8 tracking-tight">
                    Let's build the <br/>
                    <span className="text-indigo-600">future together.</span>
                </h2>
                <p className="text-slate-500 text-lg mb-12 leading-relaxed">
                    Ready to modernize your digital presence? We're currently accepting select projects for Q3 & Q4 2026.
                </p>

                <div className="space-y-4">
                    <a href="tel:4045520926" className="group p-6 rounded-2xl bg-white border border-slate-200 flex items-center gap-6 hover:border-indigo-600/30 hover:shadow-lg hover:shadow-indigo-900/5 transition-all duration-300">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                            <Phone className="w-5 h-5 text-slate-900 group-hover:text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-lg">Call Us</h4>
                            <p className="text-slate-500 font-mono text-sm mt-1">(404) 552-0926</p>
                        </div>
                    </a>
                    
                    <a href="mailto:hello@customwebsitesplus.com" className="group p-6 rounded-2xl bg-white border border-slate-200 flex items-center gap-6 hover:border-indigo-600/30 hover:shadow-lg hover:shadow-indigo-900/5 transition-all duration-300">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                            <Mail className="w-5 h-5 text-slate-900 group-hover:text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-lg">Email Us</h4>
                            <p className="text-slate-500 font-mono text-sm mt-1">hello@customwebsitesplus.com</p>
                        </div>
                    </a>
                </div>
            </div>

            <div className="lg:col-span-7">
                <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                    {formStatus === 'success' ? (
                        <div className="h-96 flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                                <Send className="w-8 h-8" />
                            </div>
                            <h3 className="text-3xl font-bold text-slate-900">Request Sent</h3>
                            <p className="text-slate-500 mt-4 max-w-xs mx-auto">We've received your details and will be in touch within 24 hours.</p>
                            <button 
                                onClick={() => setFormStatus('idle')}
                                className="mt-8 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="group relative">
                                    <input required type="text" className="peer w-full px-0 py-4 bg-transparent border-b-2 border-slate-200 focus:border-indigo-600 outline-none transition-all font-medium text-slate-900 placeholder-transparent" placeholder="Name" id="name" />
                                    <label htmlFor="name" className="absolute left-0 -top-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-4 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-indigo-600">Name</label>
                                </div>
                                <div className="group relative">
                                    <input required type="email" className="peer w-full px-0 py-4 bg-transparent border-b-2 border-slate-200 focus:border-indigo-600 outline-none transition-all font-medium text-slate-900 placeholder-transparent" placeholder="Email" id="email" />
                                    <label htmlFor="email" className="absolute left-0 -top-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-4 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-indigo-600">Email Address</label>
                                </div>
                            </div>
                            
                            <div className="group relative">
                                <select className="peer w-full px-0 py-4 bg-transparent border-b-2 border-slate-200 focus:border-indigo-600 outline-none transition-all font-medium text-slate-900 cursor-pointer appearance-none rounded-none" id="type">
                                    <option value="" disabled selected hidden></option>
                                    <option>Website Design & Development</option>
                                    <option>AI Voice Agent Integration</option>
                                    <option>Local SEO Campaign</option>
                                    <option>Full Digital Transformation</option>
                                </select>
                                <label htmlFor="type" className="absolute left-0 -top-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-indigo-600">Interested In</label>
                            </div>

                            <div className="group relative">
                                <textarea required rows={3} className="peer w-full px-0 py-4 bg-transparent border-b-2 border-slate-200 focus:border-indigo-600 outline-none transition-all font-medium text-slate-900 placeholder-transparent resize-none" placeholder="Message" id="message"></textarea>
                                <label htmlFor="message" className="absolute left-0 -top-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-4 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-indigo-600">Project Details</label>
                            </div>

                            <div className="pt-4">
                                <button 
                                    disabled={formStatus === 'sending'}
                                    type="submit" 
                                    className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-full font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group shadow-xl shadow-slate-900/10"
                                >
                                    {formStatus === 'sending' ? 'Sending...' : 'Submit Request'}
                                    {!formStatus && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                </button>
                            </div>
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