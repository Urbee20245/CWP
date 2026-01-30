import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../src/hooks/useSEO';
import { 
  ArrowRight, 
  CheckCircle2, 
  Phone, 
  Mail,
  Zap,
  Rocket,
  Search,
  Bot,
  Smartphone,
  Shield,
  Clock,
  Users,
  Target,
  TrendingUp,
  Award,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Palette,
  Code,
  BarChart3,
  Globe
} from 'lucide-react';

const ServicesPage: React.FC = () => {
  useSEO({
    title: 'Our Services | Custom Websites Plus',
    description: 'Web design, AI integration, SEO optimization, and digital solutions. Explore our full range of services for businesses in Atlanta and beyond.',
    canonical: 'https://customwebsitesplus.com/services',
  });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Palette,
      title: 'Modern, Conversion-Focused Design',
      points: [
        'Mobile-first responsive layout',
        'Clean, professional aesthetics',
        'Brand-aligned color palette',
        'High-quality imagery and graphics',
        'User experience optimization'
      ]
    },
    {
      icon: Rocket,
      title: 'Performance Optimization',
      points: [
        'Lightning-fast load times (< 2 seconds)',
        'Core Web Vitals optimization',
        'Image compression and lazy loading',
        'Code minification',
        'CDN integration'
      ]
    },
    {
      icon: Search,
      title: 'Complete SEO Optimization',
      points: [
        'Keyword research and strategy',
        'On-page SEO (meta tags, headers, schema)',
        'Technical SEO (sitemaps, robots.txt)',
        'Local SEO optimization',
        'Google Business Profile integration'
      ]
    },
    {
      icon: Bot,
      title: 'AI Integration',
      points: [
        'AI-powered chatbot for 24/7 engagement',
        'Smart lead capture and qualification',
        'Personalized content recommendations',
        'AI-enhanced user experience'
      ]
    },
    {
      icon: Smartphone,
      title: 'Mobile Excellence',
      points: [
        'Fully responsive across all devices',
        'Touch-optimized interactions',
        'Mobile speed optimization',
        'App-like performance'
      ]
    },
    {
      icon: Shield,
      title: 'Security & Reliability',
      points: [
        'SSL certificate included',
        'Regular security updates',
        'Automatic backups',
        '99.9% uptime guarantee'
      ]
    }
  ];

  const process = [
    {
      week: 'Week 1',
      title: 'Discovery & Strategy',
      items: ['Competitive analysis', 'Audience research', 'Content audit', 'Technical requirements']
    },
    {
      week: 'Weeks 2-4',
      title: 'Design & Development',
      items: ['Wireframes and mockups', 'Client feedback and revisions', 'Custom development', 'AI integration setup']
    },
    {
      week: 'Week 5',
      title: 'Optimization & Testing',
      items: ['SEO implementation', 'Performance tuning', 'Cross-browser testing', 'Mobile responsiveness check']
    },
    {
      week: 'Week 6',
      title: 'Launch & Training',
      items: ['Domain migration', 'Go-live deployment', 'Team training', '90-day support included']
    }
  ];

  const packages = [
    {
      name: 'Essential',
      badge: null,
      features: [
        'Up to 5 pages',
        'Mobile responsive design',
        'Basic SEO optimization',
        'AI chatbot integration',
        '30-day support'
      ],
      bestFor: 'Small businesses, startups',
      gradient: 'from-blue-500 to-indigo-600'
    },
    {
      name: 'Professional',
      badge: 'Most Popular',
      features: [
        'Up to 10 pages',
        'Advanced design & animations',
        'Comprehensive SEO strategy',
        'Advanced AI features',
        'Content strategy',
        '60-day support'
      ],
      bestFor: 'Established businesses',
      gradient: 'from-indigo-600 to-purple-600'
    },
    {
      name: 'Enterprise',
      badge: null,
      features: [
        'Unlimited pages',
        'Custom functionality',
        'Premium AI integration',
        'E-commerce capabilities',
        'Ongoing consultation',
        '90-day priority support'
      ],
      bestFor: 'Multi-location, high-revenue businesses',
      gradient: 'from-purple-600 to-pink-600'
    }
  ];

  const faqs = [
    {
      question: 'How long does a website rebuild take?',
      answer: 'Most projects are completed within 4-6 weeks from start to launch. Complex projects with e-commerce or custom functionality may take 8-10 weeks. We provide a detailed timeline during your consultation.'
    },
    {
      question: 'Will my SEO rankings be affected during migration?',
      answer: 'We implement proper 301 redirects and follow Google\'s best practices to preserve your search rankings. In most cases, sites see improved rankings within 30-60 days post-launch due to better performance and optimization.'
    },
    {
      question: 'Can I update the website myself after launch?',
      answer: 'Absolutely! We provide comprehensive training and documentation. Your site is built on a user-friendly platform that allows you to easily update content, images, and more without technical knowledge.'
    },
    {
      question: 'What happens after the support period?',
      answer: 'After the initial support period, you can continue on a monthly maintenance plan (optional) or handle updates yourself. We\'re always available for additional work or support on a project basis.'
    },
    {
      question: 'Do you offer payment plans?',
      answer: 'Yes, we offer flexible payment structures including milestone-based payments and monthly payment plans for qualified clients. We\'ll discuss the best option during your consultation.'
    },
    {
      question: 'What if I already have a domain and hosting?',
      answer: 'We can work with your existing domain and hosting, or help you migrate to a better solution if needed. We\'ll assess your current setup during the discovery phase and make recommendations.'
    }
  ];

  const whyUs = [
    {
      icon: BarChart3,
      title: 'Data-Driven Approach',
      description: 'We don\'t guess, we analyze. Every decision is backed by data and proven best practices.'
    },
    {
      icon: Award,
      title: 'Proven Results',
      description: 'Portfolio of successful rebuilds with measurable improvements in traffic and conversions.'
    },
    {
      icon: MapPin,
      title: 'Local Expertise',
      description: 'Serving Atlanta and Metro area with deep understanding of local market dynamics.'
    },
    {
      icon: Users,
      title: 'Ongoing Partnership',
      description: 'We\'re invested in your long-term success, not just the initial launch.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      
      {/* HERO SECTION */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold uppercase tracking-wide mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Premium Website Services</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            Transform Your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Digital Presence</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Professional website rebuilds that convert visitors into customers
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/contact"
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-indigo-200 transition-all hover:scale-105 flex items-center gap-2"
            >
              Schedule Free Consultation
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/jetsuite"
              className="px-8 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-xl font-bold text-lg hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-2"
            >
              See How Your Site Ranks
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* THE PROBLEM SECTION */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Your Website is Your 24/7 Salesperson
            </h2>
            <p className="text-2xl text-slate-300 mb-4">
              Is it costing you customers or bringing them in?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 text-center hover:bg-white/10 transition-all">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-5xl font-bold text-white mb-4">53%</div>
              <p className="text-slate-300 leading-relaxed">
                of mobile users abandon sites that take over 3 seconds to load
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 text-center hover:bg-white/10 transition-all">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-amber-400" />
              </div>
              <div className="text-5xl font-bold text-white mb-4">75%</div>
              <p className="text-slate-300 leading-relaxed">
                of users judge credibility based on website design
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 text-center hover:bg-white/10 transition-all">
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="text-5xl font-bold text-white mb-4">70%</div>
              <p className="text-slate-300 leading-relaxed">
                of small business websites lack basic SEO optimization
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/jetsuite"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all"
            >
              Check Your Website Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* OUR SOLUTION SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Complete Website Transformation
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Modern design meets cutting-edge AI technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:border-indigo-200 transition-all group"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <IconComponent className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">
                    {feature.title}
                  </h3>
                  <ul className="space-y-3">
                    {feature.points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROCESS SECTION */}
      <section className="py-24 bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              From Outdated to Outstanding in 4-6 Weeks
            </h2>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="hidden md:block absolute top-0 left-1/2 w-1 h-full bg-gradient-to-b from-indigo-200 via-purple-200 to-indigo-200 -translate-x-1/2"></div>

            <div className="space-y-12">
              {process.map((step, index) => (
                <div
                  key={index}
                  className={`flex flex-col md:flex-row gap-8 items-center ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  <div className="flex-1 bg-white rounded-2xl p-8 shadow-lg border border-slate-200 hover:shadow-2xl transition-all">
                    <div className="text-sm font-bold text-indigo-600 mb-2">{step.week}</div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{step.title}</h3>
                    <ul className="space-y-2">
                      {step.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Number Badge */}
                  <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {index + 1}
                  </div>

                  <div className="flex-1 hidden md:block"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BEFORE & AFTER SHOWCASE */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Real Results for Real Businesses
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="group relative overflow-hidden rounded-2xl border-2 border-red-200 hover:border-red-400 transition-all">
              <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-red-500 text-white rounded-full text-sm font-bold">
                BEFORE
              </div>
              <div className="aspect-video bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="text-6xl mb-4">🐌</div>
                  <p className="text-slate-600 font-semibold">Slow, outdated design</p>
                  <p className="text-sm text-slate-500 mt-2">5.2s load time</p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 transition-all">
              <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold">
                AFTER
              </div>
              <div className="aspect-video bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-8">
                <div className="text-center text-white">
                  <div className="text-6xl mb-4">⚡</div>
                  <p className="font-semibold">Modern, fast, optimized</p>
                  <p className="text-sm text-indigo-200 mt-2">1.3s load time</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-200">
              <div className="text-3xl font-bold text-emerald-600 mb-2">70%</div>
              <p className="text-slate-600">Load Time Reduced</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-200">
              <div className="text-3xl font-bold text-indigo-600 mb-2">45%</div>
              <p className="text-slate-600">Conversions Increased</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-200">
              <div className="text-3xl font-bold text-purple-600 mb-2">3.2x</div>
              <p className="text-slate-600">More Organic Traffic</p>
            </div>
          </div>
        </div>
      </section>

      {/* PACKAGE OPTIONS */}
      <section className="py-24 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Tailored Solutions for Every Business
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Every project is unique. Let's discuss what's right for you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {packages.map((pkg, index) => (
              <div
                key={index}
                className="relative bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all group"
              >
                {pkg.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full text-white text-sm font-bold">
                    {pkg.badge}
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-4">{pkg.name}</h3>
                  <div className={`w-20 h-1 bg-gradient-to-r ${pkg.gradient} mx-auto mb-6`}></div>
                </div>

                <ul className="space-y-4 mb-8">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-200">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mb-6 pt-6 border-t border-white/10">
                  <p className="text-sm text-slate-400 mb-2">Best for:</p>
                  <p className="text-slate-200 font-semibold">{pkg.bestFor}</p>
                </div>

                <Link
                  to="/contact"
                  className={`block w-full py-3 rounded-xl font-bold text-center bg-gradient-to-r ${pkg.gradient} text-white hover:shadow-xl transition-all`}
                >
                  Discuss This Package
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
            <p className="text-lg text-slate-300 mb-6">
              Want to see how your current website measures up first?
            </p>
            <Link
              to="/jetsuite"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all"
            >
              Run Free Analysis
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Why Custom Websites Plus?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyUs.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={index}
                  className="text-center group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-lg text-slate-900 pr-4">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-8 pb-6 text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
        
        <div className="relative max-w-5xl mx-auto px-6 text-center z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-bold uppercase tracking-wide mb-8">
            <Zap className="w-4 h-4" />
            <span>Get Started Today</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to Transform Your Website?
          </h2>
          <p className="text-xl md:text-2xl mb-12 text-white/90 max-w-3xl mx-auto">
            Schedule a free consultation to discuss your project and get a custom quote
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to="/contact"
              className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-bold text-lg hover:bg-slate-100 transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              Schedule Consultation
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/jetsuite"
              className="px-8 py-4 bg-white/10 backdrop-blur text-white border-2 border-white/20 rounded-xl font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              Test Your Site First
              <Rocket className="w-5 h-5" />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-white/90">
            <a href="tel:8442130694" className="flex items-center gap-2 hover:text-white transition-colors">
              <Phone className="w-5 h-5" />
              <span className="font-semibold">(844) 213-0694</span>
            </a>
            <span className="hidden sm:inline">•</span>
            <a href="mailto:hello@customwebsitesplus.com" className="flex items-center gap-2 hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
              <span className="font-semibold">hello@customwebsitesplus.com</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;