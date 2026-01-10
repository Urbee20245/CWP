import React from 'react';
import { ArrowRight, Phone, CheckCircle2, Play, TrendingUp, Star, Cpu, Zap, Shield } from 'lucide-react';
import { NavigationLink } from '../types';
import { Link } from 'react-router-dom';

const Hero: React.FC = () => {
  // Client avatar paths from your public folder
  const CLIENT_AVATARS = [
    '/CWPC1.png',
    '/CWPC2.png',
    '/CWPC3.png',
    '/CWPC4.png'
  ];

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-20 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30 lg:pt-32">
      {/* Modern Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/20 via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f4ff_1px,transparent_1px),linear-gradient(to_bottom,#f0f4ff_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-blue-200/10 to-purple-200/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Value Proposition */}
            <div className="flex flex-col items-start text-left animate-fade-in-up">
                
                {/* Expertise Badge */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-blue-700 text-sm font-semibold uppercase tracking-wider mb-8 shadow-sm hover:shadow-md transition-shadow group">
                    <Zap className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span>Premium Web Solutions Since 2018</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
                  Transform Your Business With
                  <br/>
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      Digital Excellence
                    </span>
                    <svg className="absolute w-full h-3 -bottom-2 left-0 text-blue-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                        <path d="M0 8 Q 25 3, 50 8 T 100 3" stroke="currentColor" strokeWidth="8" fill="none" />
                    </svg>
                  </span>
                </h1>
                
                <p className="text-xl text-slate-600 mb-10 max-w-xl leading-relaxed font-normal">
                  We build <span className="font-semibold text-blue-600">high-performance websites</span>, 
                  <span className="font-semibold text-indigo-600"> custom web applications</span>, and 
                  <span className="font-semibold text-purple-600"> AI-powered solutions</span> that drive 
                  measurable business growth for modern companies and professionals.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full mb-12">
                  {/* UPDATED: Link to external contact page */}
                  <a 
                    href="https://www.customwebsitesplus.com/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl hover:shadow-blue-500/20 active:scale-95 hover:scale-[1.02] duration-300 group"
                  >
                    <span className="flex items-center justify-center gap-3">
                      Book Your Free Strategy Call
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </span>
                    <span className="block text-sm font-normal opacity-90 mt-2 text-blue-100 text-center">
                      Get a custom roadmap for your digital growth
                    </span>
                  </a>
                  
                  <a 
                    href={`#${NavigationLink.Services}`}
                    className="w-full sm:w-auto px-10 py-5 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm hover:shadow-lg hover:scale-[1.02] duration-300 flex items-center justify-center gap-3"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    See How It Works
                  </a>
                </div>

                {/* Expertise Points */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/50 border border-slate-100 hover:border-blue-100 hover:bg-white hover:shadow-sm transition-all duration-200">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                      <Cpu className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Custom Web Apps</h3>
                      <p className="text-sm text-slate-600">Streamline operations with bespoke business software</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/50 border border-slate-100 hover:border-indigo-100 hover:bg-white hover:shadow-sm transition-all duration-200">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Modern Web Design</h3>
                      <p className="text-sm text-slate-600">Sites that convert with cutting-edge UX/UI</p>
                    </div>
                  </div>
                </div>

                {/* Social Proof with YOUR images */}
                <div className="mt-12 pt-8 border-t border-slate-200/50 w-full">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-3 flex-shrink-0">
                        {CLIENT_AVATARS.map((avatar, index) => (
                          <img 
                            key={index}
                            src={avatar}
                            alt={`Client ${index + 1}`}
                            className="w-12 h-12 rounded-full border-3 border-white shadow object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map((i) => (
                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                          <span className="ml-2 text-sm font-bold text-slate-700">5.0</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          Trusted by <span className="font-bold text-slate-900">150+</span> businesses worldwide
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:block h-10 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-3">
                      <Shield className="w-10 h-10 text-blue-500" />
                      <div>
                        <div className="text-lg font-bold text-slate-900">100%</div>
                        <div className="text-sm text-slate-600">Client Satisfaction</div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

            {/* Right Column: Modern Dashboard (Desktop) */}
            <div className="relative hidden lg:block animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="relative z-10 bg-gradient-to-br from-white to-slate-50/50 rounded-3xl shadow-2xl shadow-blue-900/5 border border-slate-100/80 overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-500 backdrop-blur-sm">
                    {/* Modern Browser Header */}
                    <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-400 to-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-400 to-green-500"></div>
                        </div>
                        <div className="text-xs font-medium text-slate-400">dashboard.customwebsitesplus.com</div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                        <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-indigo-500"></div>
                      </div>
                    </div>
                    
                    {/* Business Dashboard Content */}
                    <div className="p-8 space-y-8">
                      {/* Header Stats */}
                      <div className="grid grid-cols-3 gap-6">
                        <div className="text-center p-4 rounded-xl bg-gradient-to-b from-white to-blue-50/50 border border-blue-100">
                          <div className="text-2xl font-bold text-blue-600 mb-1">↑ 312%</div>
                          <div className="text-xs font-semibold text-slate-600">Lead Growth</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-b from-white to-emerald-50/50 border border-emerald-100">
                          <div className="text-2xl font-bold text-emerald-600 mb-1">8.7s</div>
                          <div className="text-xs font-semibold text-slate-600">Avg. Task Time</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-gradient-to-b from-white to-purple-50/50 border border-purple-100">
                          <div className="text-2xl font-bold text-purple-600 mb-1">94%</div>
                          <div className="text-xs font-semibold text-slate-600">Satisfaction</div>
                        </div>
                      </div>
                      
                      {/* Revenue Chart */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900">Monthly Revenue Growth</h3>
                          <span className="text-sm font-bold text-emerald-600">+47%</span>
                        </div>
                        <div className="h-32 flex items-end gap-1">
                          {[40, 55, 65, 80, 95, 100, 120, 140].map((height, i) => (
                            <div 
                              key={i}
                              className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg hover:from-blue-600 hover:to-blue-500 transition-all"
                              style={{ height: `${height}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Jan</span>
                          <span>Mar</span>
                          <span>May</span>
                          <span>Jul</span>
                          <span>Sep</span>
                          <span>Nov</span>
                        </div>
                      </div>
                      
                      {/* Active Projects */}
                      <div className="space-y-4">
                        <h3 className="font-bold text-slate-900">Active Projects</h3>
                        <div className="space-y-3">
                          {[
                            { name: 'SaaS Platform', progress: 85, color: 'from-blue-500 to-indigo-500' },
                            { name: 'E-commerce Portal', progress: 70, color: 'from-emerald-500 to-green-500' },
                            { name: 'CRM Integration', progress: 60, color: 'from-purple-500 to-pink-500' },
                          ].map((project, i) => (
                            <div key={i} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-slate-700">{project.name}</span>
                                <span className="font-bold text-slate-900">{project.progress}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full bg-gradient-to-r ${project.color} rounded-full`} style={{ width: `${project.progress}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Floating AI Assistant Card */}
                    <div className="absolute -bottom-8 -right-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-2xl shadow-slate-900/30 border border-slate-700/50 hover:-translate-y-2 transition-transform duration-300 max-w-xs">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Cpu className="w-7 h-7 text-white" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-400 font-medium">AI Assistant</div>
                          <div className="font-bold text-sm">Processing Requests</div>
                          <div className="text-xs text-blue-300 mt-1">24/7 Automated Support</div>
                        </div>
                      </div>
                    </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl -z-10"></div>
            </div>
        </div>

        {/* Mobile-Only Portfolio Preview */}
        <div className="relative lg:hidden mt-12 animate-fade-in-up">
          <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-2xl shadow-xl p-6 border border-slate-100/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-xl font-bold text-slate-900">Featured Work</div>
                <div className="text-sm text-slate-600 mt-1">Across industries & business sizes</div>
              </div>
              <div className="text-xs px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-full font-bold border border-blue-100">
                150+ Projects
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="h-32 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center">
                  <div className="text-center p-4">
                    <div className="text-2xl font-bold text-blue-600 mb-1">SaaS</div>
                    <div className="text-xs text-blue-700">Web Applications</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">Custom CRM Platform</div>
                <div className="text-xs text-slate-600">+300% workflow efficiency</div>
              </div>
              
              <div className="space-y-3">
                <div className="h-32 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200 flex items-center justify-center">
                  <div className="text-center p-4">
                    <div className="text-2xl font-bold text-emerald-600 mb-1">E-comm</div>
                    <div className="text-xs text-emerald-700">Online Stores</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">Luxury Retail Site</div>
                <div className="text-xs text-slate-600">2.5x conversion rate</div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-600">
                From startups to enterprises, we deliver exceptional digital experiences
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
