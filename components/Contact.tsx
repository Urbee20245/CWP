import React, { useState, useRef } from 'react';
import { Mail, Phone, ArrowRight, Clock, Calendar, MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { NavigationLink } from '../types';
import { Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { FormService } from '../src/services/formService'; // Import FormService

// NOTE: This key must be set in .env.local or Vercel environment variables
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

const Contact: React.FC = () => {
    const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
    const [formError, setFormError] = useState<string | null>(null);
    const recaptchaRef = useRef<ReCAPTCHA>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('sending');
        setFormError(null);

        if (!RECAPTCHA_SITE_KEY) {
            setFormError("reCAPTCHA is not configured. Please set VITE_RECAPTCHA_SITE_KEY.");
            setFormStatus('error');
            return;
        }

        try {
            const recaptchaToken = await recaptchaRef.current?.execute('contact_form');
            if (!recaptchaToken) {
                throw new Error("reCAPTCHA verification failed. Please try again.");
            }
            
            // --- SECURE BACKEND SUBMISSION ---
            await FormService.submitContactForm({
                ...formData,
                recaptchaToken,
            });
            
            setFormStatus('success');
            setFormData({ name: '', email: '', phone: '', message: '' });

        } catch (error: any) {
            console.error("Form submission error:", error);
            setFormError(error.message || "Submission failed due to a security check or network error.");
            setFormStatus('error');
        } finally {
            recaptchaRef.current?.reset();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

  return (
    <section id={NavigationLink.Contact} className="py-24 bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Quick inquiry? Send us a message and we'll get back to you within 24 hours.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* Left Column: Simple Form */}
            <div className="lg:col-span-3">
                {formStatus === 'success' ? (
                    <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-8 text-center">
                        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h3>
                        <p className="text-slate-600 mb-6">We'll get back to you within 24 hours.</p>
                        <button 
                            onClick={() => setFormStatus('idle')}
                            className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors text-sm"
                        >
                            Send another message
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            
                            {formError && (
                                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Your Full Name"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    disabled={formStatus === 'sending'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address *</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="your@email.com"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    disabled={formStatus === 'sending'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number *</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    placeholder="(404) 555-1234"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    disabled={formStatus === 'sending'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Brief Message *</label>
                                <textarea
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    rows={3}
                                    placeholder="Tell us briefly what you need help with..."
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                                    disabled={formStatus === 'sending'}
                                />
                            </div>
                            
                            {/* Invisible ReCAPTCHA v3 Component */}
                            {RECAPTCHA_SITE_KEY && formStatus !== 'success' && (
                                <ReCAPTCHA
                                    ref={recaptchaRef}
                                    sitekey={RECAPTCHA_SITE_KEY}
                                    size="invisible"
                                />
                            )}

                            <button
                                type="submit"
                                disabled={formStatus === 'sending'}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {formStatus === 'sending' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send Message
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-slate-200 text-center">
                            <p className="text-slate-600 mb-4 font-semibold">Need a full consultation?</p>
                            <Link
                                to="/contact"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all hover:shadow-xl"
                            >
                                <Calendar className="w-5 h-5" />
                                Schedule Consultation
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Contact Info */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Call Card */}
                <a href="tel:8442130694" className="group block p-6 rounded-2xl bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Call Now</div>
                        <Phone className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">(844) 213-0694</h3>
                    <p className="text-slate-400 text-sm">Mon-Fri: 9am-6pm ET</p>
                </a>

                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow space-y-4">
                    <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm">Email</h4>
                            <a href="mailto:hello@customwebsitesplus.com" className="text-slate-600 text-sm hover:text-indigo-600 transition-colors">
                                hello@customwebsitesplus.com
                            </a>
                        </div>
                    </div>

                    <div className="h-px bg-slate-200"></div>

                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm">Location</h4>
                            <p className="text-slate-600 text-sm">Atlanta, GA<br/>Serving Metro Area</p>
                        </div>
                    </div>

                    <div className="h-px bg-slate-200"></div>

                    <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm">Hours</h4>
                            <p className="text-slate-600 text-sm">Mon-Fri: 9am-6pm ET<br/>Sat: 10am-4pm ET<br/>Sun: Closed</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;