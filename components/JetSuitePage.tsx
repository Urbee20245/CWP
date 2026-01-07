import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Eye, MapPin, Sparkles, ArrowRight, Bell, CheckCircle2 } from 'lucide-react';

const JetSuitePage: React.FC = () => {
  const [showWaitlist, setShowWaitlist] = useState(false);

  const tools = [
    {
      id: 'jet-local-optimizer',
      icon: Zap,
      title: 'Jet Local Optimizer',
      description: 'Complete website health check in 60 seconds. Analyze Core Web Vitals, mobile responsiveness, SEO structure, local relevance, and keyword gaps.',
      badge: 'FREE TOOL',
      ctaText: 'Run Audit',
      ctaLink: '/jet-local-optimizer',
      gradient: 'from-blue-500 to-indigo-600',
      bgGradient: 'from-blue-50 to-indigo-50',
      hoverShadow: 'hover:shadow-blue-200',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      isActive: true,
    },
    {
      id: 'jetviz',
      icon: Eye,
      title: 'JetViz',
      description: 'Visual website modernization analysis. See your site through your customers\' eyes with design era detection, trust signals, and mobile preview.',
      badge: 'FREE TOOL',
      ctaText: 'Visualize Now',
      ctaLink: '/jetviz',
      gradient: 'from-purple-500 to-pink-600',
      bgGradient: 'from-purple-50 to-pink-50',
      hoverShadow: 'hover:shadow-purple-200',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      isActive: true,
    },
  ];

  const allJetSuiteTools = [
    { name: 'JetBiz', category: 'Foundation' },
    { name: 'JetLocal Optimizer', category: 'Foundation' },
    { name: 'JetViz', category: 'Foundation' },
    { name: 'Growth Score', category: 'Foundation' },
    { name: 'Business Details', category: 'Foundation' },
    { name: 'JetCreate', category: 'Marketing' },
    { name: 'JetPost', category: 'Marketing' },
    { name: 'JetContent', category: 'Marketing' },
    { name: 'JetImage', category: 'Marketing' },
    { name: 'JetSocial', category: 'Marketing' },
    { name: 'JetReply', category: 'Engagement' },
    { name: 'JetReviews', category: 'Engagement' },
    { name: 'JetLeads', category: 'Engagement' },
    { name: 'JetEvents', category: 'Engagement' },
    { name: 'JetBooking', category: 'Engagement' },
    { name: 'Growth Plan', category: 'Strategy' },
    { name: 'Command Center', category: 'Strategy' },
    { name: 'Home Dashboard', category: 'Strategy' },
    { name: 'Analytics', category: 'Strategy' },
    { name: 'Knowledge Base', category: 'Strategy' },
  ];
  
  const toolsToShow = allJetSuiteTools.slice(0, 15);
  const remainingToolsCount = allJetSuiteTools.length - toolsToShow.length;


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-bold uppercase tracking-widest mb-8">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Complete Digital Toolkit
          </div>

          {/* Jet Automations Logo */}
          <img 
            src="/Jetautofull.png" 
            alt="Jet Automations" 
            className="h-16 md:h-20 w-auto mx-auto mb-6 object-contain"
          />

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
            JetSuite
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mt-2">
              by Jet Automations
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Complete Digital Toolkit for Local Business Growth
          </p>

          {/* Stats/Features Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-white text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Free Analysis Tools</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-white text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Results</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-white text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>No Login Required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section Header - Start with Free Analysis */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Start with Free Analysis Tools
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Discover what's holding your website back. Our diagnostic tools provide instant, actionable insights to improve your online presence.
          </p>
        </div>
      </section>

      {/* Tool Cards Grid */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <div
                  key={tool.id}
                  className={`
                    group relative bg-white rounded-2xl border border-slate-200 overflow-hidden
                    transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${tool.hoverShadow}
                    ${!tool.isActive ? 'opacity-75' : ''}
                  `}
                >
                  {/* Top Accent Line */}
                  <div className={`h-1 bg-gradient-to-r ${tool.gradient}`}></div>

                  {/* Card Content */}
                  <div className="p-8">
                    {/* Badge */}
                    <div className="absolute top-6 right-6">
                      <span
                        className={`
                          px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest
                          ${tool.isActive 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }
                        `}
                      >
                        {tool.badge}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-xl ${tool.iconBg} ${tool.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="w-8 h-8" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">
                      {tool.title}
                    </h3>

                    {/* Description */}
                    <p className="text-slate-600 leading-relaxed mb-8 min-h-[120px]">
                      {tool.description}
                    </p>

                    {/* CTA Button */}
                    {tool.isActive ? (
                      <Link
                        to={tool.ctaLink}
                        className={`
                          w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                          bg-gradient-to-r ${tool.gradient} text-white font-bold
                          transition-all duration-300 hover:shadow-lg group-hover:gap-4
                        `}
                      >
                        {tool.ctaText}
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => setShowWaitlist(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-200 transition-all duration-300"
                      >
                        <Bell className="w-5 h-5" />
                        {tool.ctaText}
                      </button>
                    )}
                  </div>

                  {/* Hover Effect Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.bgGradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`}></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* JetSuite Platform Overview Section (Replaces 'More Tools Coming Soon') */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            JetSuite — One System for Business Growth
          </h2>
          <p className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto">
            JetSuite helps organizations set up their business correctly, present a strong brand, and actively engage customers — all from one unified system.
          </p>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
            {toolsToShow.map((tool, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center hover:border-indigo-300 hover:bg-indigo-50/50 transition-all duration-300"
              >
                <h4 className="font-bold text-slate-900 text-sm">{tool.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{tool.category}</p>
              </div>
            ))}
            {remainingToolsCount > 0 && (
                <div className="p-4 rounded-xl bg-slate-900 text-white text-center flex items-center justify-center border border-slate-700">
                    <span className="font-bold text-sm">+{remainingToolsCount} More Inside JetSuite</span>
                </div>
            )}
          </div>

          {/* CTA Button */}
          <a
            href="https://getjetsuite.com"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            Visit JetSuite
          </a>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Grow with JetSuite?
          </h2>
          <p className="text-xl text-slate-300 mb-10">
            JetSuite is the complete AI-powered platform built to help businesses improve visibility, strengthen their brand, and engage customers — all from one system.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://getjetsuite.com"
              className="px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Visit JetSuite
            </a>
            <a
              href="https://getjetsuite.com"
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-5 h-5" />
              Explore the Platform
            </a>
          </div>
        </div>
      </section>

      {/* Waitlist Modal */}
      {showWaitlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white mx-auto mb-6">
              <Bell className="w-8 h-8" />
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-4 text-center">
              Join the Waitlist
            </h3>
            <p className="text-slate-600 mb-6 text-center">
              Be the first to know when new tools launch. We'll send you early access and exclusive updates.
            </p>
            
            <form className="space-y-4">
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                required
              />
              <button
                type="submit"
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg transition-all"
              >
                Notify Me
              </button>
            </form>
            
            <button
              onClick={() => setShowWaitlist(false)}
              className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Custom Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.9);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default JetSuitePage;