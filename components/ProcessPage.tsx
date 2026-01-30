import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../src/hooks/useSEO';
import { 
  Search, 
  FileText, 
  Palette, 
  Code, 
  ShieldCheck, 
  Rocket, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Target, 
  BarChart3, 
  Users, 
  Award,
  ChevronDown,
  ChevronUp,
  Zap,
  Layout,
  MessageSquare,
  SearchCheck,
  Server,
  Smartphone,
  Lock
} from 'lucide-react';

const ProcessPage: React.FC = () => {
  useSEO({
    title: 'Our Process | Custom Websites Plus',
    description: 'Learn about our step-by-step web design and development process. From discovery to launch, see how Custom Websites Plus builds your online presence.',
    canonical: 'https://customwebsitesplus.com/process',
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const stats = [
    { label: "Timeline", value: "4-6 Weeks", icon: Clock },
    { label: "Approach", value: "100% Custom", icon: Target },
    { label: "Strategy", value: "Data-Driven", icon: BarChart3 },
    { label: "Style", value: "Collaborative", icon: Users },
    { label: "Outcome", value: "Guaranteed", icon: Award },
  ];

  const phases = [
    {
      id: 1,
      name: "Analysis & Discovery",
      timeline: "Before We Start",
      description: "We don't guess. We analyze. Before a single line of code is written, we audit your current presence to identify exactly where you're losing customers.",
      deliverable: "Custom Audit Report",
      icon: Search,
      color: "blue",
      details: [
        "JetViz visual assessment",
        "Technical performance scan",
        "Competitor gap analysis",
        "Goal setting consultation"
      ],
      cta: { text: "Start Free Analysis", link: "/jetsuite" }
    },
    {
      id: 2,
      name: "Strategy & Planning",
      timeline: "Week 1",
      description: "We build the blueprint. Based on our analysis, we create a comprehensive roadmap that aligns design, content, and technology with your business goals.",
      deliverable: "Strategy Document",
      icon: FileText,
      color: "indigo",
      details: [
        "Target audience profiling",
        "SEO keyword strategy",
        "Site architecture map",
        "Content strategy outline"
      ]
    },
    {
      id: 3,
      name: "Design & Prototyping",
      timeline: "Weeks 2-3",
      description: "Visualizing the future. We craft high-fidelity mockups that bring your brand to life, iterating until it matches your vision perfectly.",
      deliverable: "Interactive Mockups",
      icon: Palette,
      color: "purple",
      details: [
        "UX/UI wireframing",
        "Mobile & desktop designs",
        "Brand identity integration",
        "Unlimited design revisions"
      ]
    },
    {
      id: 4,
      name: "Development & AI",
      timeline: "Weeks 3-4",
      description: "Building the engine. We code your site from scratch using modern frameworks and integrate intelligent AI agents to handle customer service.",
      deliverable: "Working Beta Site",
      icon: Code,
      color: "pink",
      details: [
        "Clean, semantic coding",
        "AI chatbot configuration",
        "CMS setup (easy updates)",
        "Content migration"
      ]
    },
    {
      id: 5,
      name: "Testing & Refinement",
      timeline: "Week 5",
      description: "Perfecting the details. We rigorously test across all devices and browsers, optimizing for speed, security, and SEO dominance.",
      deliverable: "100/100 Performance",
      icon: ShieldCheck,
      color: "emerald",
      details: [
        "Cross-browser testing",
        "Mobile responsiveness check",
        "Speed optimization (<2s load)",
        "Security hardening"
      ]
    },
    {
      id: 6,
      name: "Launch & Support",
      timeline: "Week 6",
      description: "Liftoff. We handle the technical migration and provide training so you're in control. Then, we stick around to ensure you grow.",
      deliverable: "Live Website",
      icon: Rocket,
      color: "orange",
      details: [
        "Zero-downtime deployment",
        "Google Analytics setup",
        "Team training session",
        "90-day priority support"
      ]
    }
  ];

  const deliverables = [
    "Comprehensive website analysis",
    "Strategy & planning documents",
    "Custom design mockups",
    "Fully coded responsive website",
    "AI chatbot integration",
    "Complete SEO optimization",
    "Performance optimization (< 2s)",
    "Mobile-first design architecture",
    "Security & SSL setup",
    "Google Analytics integration",
    "Content management training",
    "90-day priority support",
    "Monthly performance reports"
  ];

  const faqs = [
    {
      q: "What if I don't like the design?",
      a: "We offer unlimited revisions during the design phase. We don't move to development until you are 100% thrilled with the look and feel of the mockups."
    },
    {
      q: "Can the timeline be faster?",
      a: "Yes! We can accommodate rush projects for urgent deadlines. Let us know your constraints during the consultation and we will build a custom timeline."
    },
    {
      q: "What if my business changes after launch?",
      a: "We build flexible, scalable websites. Your site is designed to grow with you, and our support plans ensure updates are handled quickly."
    },
    {
      q: "Do I need to provide content?",
      a: "You can provide your own content, or our team of copywriters can create SEO-optimized content for you. Most clients choose a mix of both."
    },
    {
      q: "What happens after the 90 days of support?",
      a: "You have options. You can manage the site yourself (we provide training), or transition to one of our affordable monthly maintenance plans for peace of mind."
    },
    {
      q: "Will my current SEO rankings be affected?",
      a: "We take extreme care with migrations. We implement a full 301 redirect map to preserve your authority, and our optimization usually leads to ranking improvements shortly after launch."
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900 pt-16">
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-20 pb-32 overflow-hidden bg-slate-900 text-white">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-sm">
            <Zap className="w-3 h-3" />
            <span>Proven Methodology</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight font-serif">
            Your Journey to <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">Digital Excellence</span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
            A proven 4-6 week process that transforms outdated websites into 
            high-performance customer-generating machines.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/contact" 
              className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105"
            >
              Start Your Transformation
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. OVERVIEW STATS */}
      <section className="relative -mt-16 z-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-3">
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-900 text-lg">{stat.value}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. THE PROCESS TIMELINE */}
      <section className="py-32 bg-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 font-serif">The Blueprint</h2>
            <p className="text-slate-600 text-lg">From audit to launch in six disciplined steps.</p>
          </div>

          <div className="relative">
            {/* Center Line (Desktop) */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-purple-200 to-emerald-200 -translate-x-1/2"></div>

            <div className="space-y-24">
              {phases.map((phase, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <div key={phase.id} className={`relative flex flex-col md:flex-row items-center ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                    
                    {/* Content Side */}
                    <div className="flex-1 w-full md:w-1/2 p-6">
                      <div className={`bg-white p-8 rounded-3xl shadow-lg border border-slate-100 hover:shadow-2xl transition-all duration-300 group ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 bg-${phase.color}-50 text-${phase.color}-600`}>
                          {phase.timeline}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-3 md:block">
                          <span className="md:hidden text-slate-300">0{phase.id}.</span>
                          {phase.name}
                        </h3>
                        <p className="text-slate-600 mb-6 leading-relaxed">
                          {phase.description}
                        </p>
                        
                        <div className={`flex flex-col gap-2 mb-6 ${isEven ? 'md:items-end' : 'md:items-start'}`}>
                          {phase.details.map((detail, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                              {isEven && <span className="hidden md:inline text-slate-300">•</span>}
                              <CheckCircle2 className={`w-4 h-4 text-${phase.color}-500 md:hidden`} />
                              {detail}
                              {!isEven && <span className="hidden md:inline text-slate-300">•</span>}
                            </div>
                          ))}
                        </div>

                        {phase.cta ? (
                          <Link 
                            to={phase.cta.link}
                            className={`inline-flex items-center gap-2 text-sm font-bold text-${phase.color}-600 hover:text-${phase.color}-700 transition-colors`}
                          >
                            {phase.cta.text} <ArrowRight className="w-4 h-4" />
                          </Link>
                        ) : (
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold uppercase text-slate-400`}>
                            Deliverable: <span className="text-slate-700">{phase.deliverable}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline Center Icon */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex">
                      <div className={`w-16 h-16 rounded-2xl bg-white border-4 border-slate-50 shadow-xl flex items-center justify-center text-${phase.color}-600 transform transition-transform hover:scale-110`}>
                        <phase.icon className="w-8 h-8" />
                      </div>
                    </div>

                    {/* Mobile Icon (Visible only on mobile) */}
                    <div className="md:hidden mb-6 w-16 h-16 rounded-2xl bg-white border-2 border-slate-100 shadow-lg flex items-center justify-center text-indigo-600">
                        <phase.icon className="w-8 h-8" />
                    </div>

                    {/* Spacer Side */}
                    <div className="flex-1 w-full md:w-1/2 hidden md:block"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4. DIFFERIANTORS */}
      <section className="py-24 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg mb-2">Data-Driven</h3>
              <p className="text-slate-500 text-sm">We analyze before we build. No guesswork.</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg mb-2">True Partnership</h3>
              <p className="text-slate-500 text-sm">Collaborative process. You're involved every step.</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-pink-50 rounded-2xl flex items-center justify-center text-pink-600 mb-6 group-hover:scale-110 transition-transform">
                <Layout className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg mb-2">Unlimited Revisions</h3>
              <p className="text-slate-500 text-sm">We iterate until the design matches your vision perfectly.</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg mb-2">Support For Life</h3>
              <p className="text-slate-500 text-sm">We don't disappear after launch. We're your tech team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. DELIVERABLES */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-serif font-bold mb-4">What's Included?</h2>
              <p className="text-slate-400">Everything you need to dominate your market.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
              {deliverables.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-slate-300 text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. PRICING APPROACH */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 font-serif">Investment That Pays for Itself</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
              Every project is unique. Our rebuilds typically range from <span className="font-bold text-slate-900">$5,000 to $15,000</span> depending on complexity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-2">Essential</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Small Business</h3>
              <p className="text-slate-500 text-sm">Perfect for local services needing a professional 5-page presence.</p>
            </div>
            <div className="p-8 rounded-2xl bg-white border-2 border-indigo-600 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Most Popular</div>
              <div className="text-indigo-600 font-bold tracking-widest uppercase text-xs mb-2">Professional</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Growth Engine</h3>
              <p className="text-slate-500 text-sm">Advanced 10-page site with AI integration and aggressive SEO structure.</p>
            </div>
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition-colors">
              <div className="text-purple-600 font-bold tracking-widest uppercase text-xs mb-2">Enterprise</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Market Leader</h3>
              <p className="text-slate-500 text-sm">Unlimited pages, custom functionality, and multi-location support.</p>
            </div>
          </div>

          <div className="text-center">
            <Link 
              to="/contact"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-200"
            >
              Get Your Custom Quote <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-4">
              <Link to="/jetsuite" className="text-sm text-slate-500 hover:text-indigo-600 font-medium underline decoration-slate-300 underline-offset-4">
                Not sure? Use our free analysis tools first
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 font-serif">Common Questions</h2>
          <div className="space-y-4">
            {faqs.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-slate-900">{item.q}</span>
                  {openFaq === idx ? <ChevronUp className="w-5 h-5 text-indigo-600" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-6 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA */}
      <section className="py-24 bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 opacity-50"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 font-serif">
            Your Website Transformation <br/> Starts Here.
          </h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join dozens of Atlanta businesses who chose excellence over mediocrity.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              to="/contact"
              className="bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-slate-100 transition-all hover:scale-105"
            >
              Schedule Free Consultation
            </Link>
            <Link 
              to="/jetsuite"
              className="bg-white/10 backdrop-blur border border-white/20 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all"
            >
              Analyze My Site Free
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-500">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No Obligation</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Free Analysis</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Fast Quote</span>
          </div>
        </div>
      </section>

    </div>
  );
};

export default ProcessPage;
