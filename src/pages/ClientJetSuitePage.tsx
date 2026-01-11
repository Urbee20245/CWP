"use client";

import React, { useState } from 'react';
import ClientLayout from '../components/ClientLayout';
import { Link } from 'react-router-dom';
import { 
    Sparkles, 
    CheckCircle2, 
    ArrowRight, 
    ChevronDown, 
    ChevronUp, 
    Zap, 
    Eye, 
    Search, 
    MapPin, 
    FileText, 
    Image, 
    MessageSquare, 
    Star, 
    TrendingUp, 
    List, 
    Gauge, 
    Home, 
    User, 
    DollarSign, 
    Clock,
    Lock,
    ExternalLink // ADDED: Missing import
} from 'lucide-react';

interface ToolCardProps {
    icon: React.FC<any>;
    title: string;
    subtitle: string;
    description: string;
    replaces: string;
    isFeatured?: boolean;
    iconColor: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ icon: Icon, title, subtitle, description, replaces, isFeatured, iconColor }) => (
    <div className="relative p-6 bg-slate-800/50 border border-slate-700 rounded-xl shadow-lg hover:border-indigo-500/50 transition-all duration-300">
        {isFeatured && (
            <span className="absolute top-0 right-0 -mt-3 -mr-3 px-3 py-1 bg-pink-600 text-white text-xs font-bold rounded-full shadow-md">
                FEATURED
            </span>
        )}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconColor} bg-slate-700/50`}>
            <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm font-medium text-indigo-300 mb-3">{subtitle}</p>
        <p className="text-slate-400 text-sm mb-4 min-h-[60px]">{description}</p>
        <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-500">Replaces:</p>
            <p className="text-sm font-semibold text-slate-300">{replaces}</p>
        </div>
    </div>
);

const FAQItem: React.FC<{ question: string, answer: string, index: number }> = ({ question, answer, index }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-slate-700">
            <button
                className="w-full flex justify-between items-center py-4 text-left text-white hover:text-indigo-400 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="font-semibold text-lg">{question}</span>
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {isOpen && (
                <div className="pb-4 text-slate-400 text-sm leading-relaxed">
                    {answer}
                </div>
            )}
        </div>
    );
};

const ClientJetSuitePage: React.FC = () => {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const tools = [
        // FOUNDATION
        { icon: Home, title: 'JetBiz', subtitle: 'Optimize Your Google Business Profile', description: 'Audits your Google Business Profile, compares you to competitors, and finds specific ranking opportunities.', replaces: 'Local SEO Consultant ($1k/mo)', iconColor: 'text-blue-400' },
        { icon: Eye, title: 'JetViz', subtitle: 'AI Website Audit & Fixes', description: 'Analyzes homepage design, SEO, speed, mobile responsiveness, and trust signals in real-time.', replaces: 'SEO Audit Tools ($200/mo)', iconColor: 'text-purple-400' },
        { icon: Search, title: 'JetKeywords', subtitle: 'Discover Profitable Local Search Terms', description: 'Find high-intent keywords customers are searching for in your specific area right now.', replaces: 'Keyword Research Tools ($99/mo)', iconColor: 'text-emerald-400' },
        { icon: MapPin, title: 'JetCompete', subtitle: 'Analyze & Beat Local Competitors', description: 'Identify competitor strengths, find gaps you can exploit, and create counter-strategies.', replaces: 'Competitive Analysis Services', iconColor: 'text-red-400' },
        
        // CREATE & PUBLISH
        { icon: Zap, title: 'JetCreate', subtitle: 'AI Creative Director', description: 'Generates social posts, images, ad copy, headlines, and everything for a campaign in one click.', replaces: 'Graphic Designer ($2k/mo)', isFeatured: true, iconColor: 'text-pink-400' },
        { icon: FileText, title: 'JetPost', subtitle: 'Social Media Content Generator', description: 'Creates platform-specific posts (Facebook, Instagram, LinkedIn) tailored to your brand voice.', replaces: 'Social Media Manager', iconColor: 'text-violet-400' },
        { icon: List, title: 'JetContent', subtitle: 'SEO-Optimized Blog Articles', description: 'Writes long-form content for your website, optimized for your target local keywords.', replaces: 'Content Writers ($0.20/word)', iconColor: 'text-cyan-400' },
        { icon: Image, title: 'JetImage', subtitle: 'AI-Generated Marketing Images', description: 'Creates custom visuals that match your brand colors and style instantly.', replaces: 'Stock Photos + Designer', iconColor: 'text-amber-400' },
        
        // ENGAGE & CONVERT
        { icon: MessageSquare, title: 'JetReply', subtitle: 'AI-Powered Review Responses', description: 'Automatically fetches Google reviews, detects sentiment, and crafts professional responses.', replaces: 'Reputation Management ($500/mo)', iconColor: 'text-green-400' },
        { icon: Star, title: 'JetTrust', subtitle: 'Review Widgets for Your Website', description: 'Create embeddable review displays to build instant trust with website visitors.', replaces: 'Review Widget Tools ($50/mo)', iconColor: 'text-yellow-400' },
        { icon: TrendingUp, title: 'JetAds', subtitle: 'High-Converting Ad Copy', description: 'Generates Google/Facebook ad headlines, descriptions, and CTAs that convert.', replaces: 'Ad Copywriter', iconColor: 'text-orange-400' },
        { icon: Gauge, title: 'JetLeads', subtitle: 'Find Customers Actively Searching', description: 'Discovers public posts from people looking for your services in your area.', replaces: 'Lead Gen Services ($1k/mo)', iconColor: 'text-indigo-400' },
        { icon: Clock, title: 'JetEvents', subtitle: 'Local Event & Promotion Ideas', description: 'Brainstorms creative events, seasonal promotions, and community engagement strategies.', replaces: 'Marketing Consultant', iconColor: 'text-teal-400' },
    ];

    const faqs = [
        { question: "Do I get access to all tools immediately?", answer: "Yes, all 20 tools are unlocked from day one. We don't believe in locking features behind paywalls or 'leveling up.' You get the full power of JetSuite immediately." },
        { question: "How many businesses can I manage?", answer: "JetSuite is designed for single-business use. If you manage multiple locations or clients, please contact us for an agency-level license." },
        { question: "What if I only need a few tools?", answer: "JetSuite is priced as a complete platform because the tools work together. However, you are free to use only the tools you need. The value is in the synergy." },
        { question: "Is there a learning curve?", answer: "No. JetSuite is designed to be intuitive. The Growth Plan feature tells you exactly what to do next, eliminating the need for complex training." },
    ];

    const growthPlanDetails = [
        "Takes findings from JetBiz, JetViz, and more",
        "Deduplicates and prioritizes tasks automatically",
        "Gives you 3-5 high-impact tasks per week",
        "Tracks completion and updates your Growth Score"
    ];

    const dashboardTools = [
        { icon: TrendingUp, title: 'Growth Score', subtitle: 'Marketing Effectiveness Score', description: '0-99 score tracking your setup completion and task execution effectiveness.', replaces: 'Analytics Dashboards' },
        { icon: Home, title: 'Home Dashboard', subtitle: 'Weekly Growth Command Center', description: 'Shows current week\'s tasks, progress, and priority actions at a glance.', replaces: 'Spreadsheets' },
        { icon: User, title: 'Business Details', subtitle: 'Central Business Profile', description: 'Store and update business info once that powers all tools automatically.', replaces: 'Brand Guidelines Doc' },
    ];

    return (
        <ClientLayout>
            <div className="min-h-screen bg-slate-900 text-white">
                
                {/* Hero Section */}
                <section className="relative pt-16 pb-24 overflow-hidden bg-slate-900">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-10"></div>
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
                    
                    <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-widest mb-8">
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            Client DIY Tools
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
                            20 Powerful Tools.
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mt-2">
                                One Growth Platform.
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
                            The complete toolkit to analyze, create, engage, and track your local business growth.
                        </p>

                        <a
                            href="https://getjetsuite.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 hover:scale-105"
                        >
                            <ExternalLink className="w-5 h-5" />
                            Visit JetSuite Platform
                        </a>
                    </div>
                </section>

                {/* Tools Grid */}
                <section className="py-20 bg-slate-900">
                    <div className="max-w-7xl mx-auto px-6 space-y-16">
                        
                        {/* 1. FOUNDATION */}
                        <div>
                            <h2 className="text-2xl font-bold text-indigo-400 mb-3 uppercase tracking-widest">Foundation</h2>
                            <p className="text-xl text-slate-300 mb-8">Analyze & Diagnose Your Starting Point</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {tools.slice(0, 4).map((tool, index) => (
                                    <ToolCard key={index} {...tool} />
                                ))}
                            </div>
                        </div>

                        {/* 2. CREATE & PUBLISH */}
                        <div>
                            <h2 className="text-2xl font-bold text-pink-400 mb-3 uppercase tracking-widest">Create & Publish</h2>
                            <p className="text-xl text-slate-300 mb-8">Generate On-Brand Content Instantly</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {tools.slice(4, 8).map((tool, index) => (
                                    <ToolCard key={index} {...tool} />
                                ))}
                            </div>
                        </div>

                        {/* 3. ENGAGE & CONVERT */}
                        <div>
                            <h2 className="text-2xl font-bold text-emerald-400 mb-3 uppercase tracking-widest">Engage & Convert</h2>
                            <p className="text-xl text-slate-300 mb-8">Build Trust & Capture More Leads</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {tools.slice(8, 13).map((tool, index) => (
                                    <ToolCard key={index} {...tool} />
                                ))}
                            </div>
                        </div>
                        
                        {/* 4. GROWTH & STRATEGY */}
                        <div>
                            <h2 className="text-2xl font-bold text-yellow-400 mb-3 uppercase tracking-widest">Growth & Strategy</h2>
                            <p className="text-xl text-slate-300 mb-8">Execute & Track Your Progress</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Growth Plan Card */}
                                <div className="relative p-8 bg-slate-800/50 border border-slate-700 rounded-xl shadow-lg">
                                    <span className="absolute top-0 right-0 -mt-3 -mr-3 px-3 py-1 bg-pink-600 text-white text-xs font-bold rounded-full shadow-md">
                                        FEATURED
                                    </span>
                                    <div className="flex items-start gap-6">
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-yellow-400 bg-slate-700/50 flex-shrink-0">
                                            <List className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-1">Growth Plan</h3>
                                            <p className="text-sm font-medium text-yellow-300 mb-4">Your Weekly Action Plan</p>
                                            <p className="text-slate-400 leading-relaxed">
                                                Takes tasks from all tools, prioritizes them, and gives you 3-5 simple weekly actions.
                                            </p>
                                            <div className="pt-4 mt-4 border-t border-slate-700">
                                                <p className="text-xs text-slate-500 mb-2">How Growth Plan Works:</p>
                                                <ul className="space-y-1 text-sm text-slate-300">
                                                    {growthPlanDetails.map((detail, i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                                            {detail}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Dashboard Tools */}
                                <div className="space-y-6">
                                    {dashboardTools.map((tool, index) => (
                                        <div key={index} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-slate-700/50 flex-shrink-0">
                                                    <tool.icon className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm">{tool.title}</h4>
                                                    <p className="text-xs text-slate-400 mt-1">{tool.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* Value Proposition Section */}
                <section className="py-20 bg-black border-t border-slate-800">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <h2 className="text-4xl font-bold text-white mb-4">
                            Replace $15,000+/Month in Services
                        </h2>
                        <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-12">
                            JetSuite replaces multiple expensive consultants and tools with one unified, affordable platform.
                        </p>
                        
                        <div className="max-w-4xl mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left text-sm">
                                <div className="col-span-1 font-bold text-slate-300">Service Replaced</div>
                                <div className="col-span-1 hidden md:block font-bold text-slate-300">Est. Monthly Cost</div>
                                <div className="col-span-1 font-bold text-slate-300 text-right">Total Value</div>
                                
                                <div className="col-span-2 md:col-span-1 text-slate-400">Web Design Agency</div>
                                <div className="col-span-1 hidden md:block text-slate-400">$2,000 - $5,000</div>
                                <div className="col-span-1 text-slate-400 text-right">$5,000</div>
                                
                                <div className="col-span-2 md:col-span-1 text-slate-400">SEO Consultant</div>
                                <div className="col-span-1 hidden md:block text-slate-400">$1,000 - $3,000</div>
                                <div className="col-span-1 text-slate-400 text-right">$3,000</div>
                                
                                <div className="col-span-2 md:col-span-1 text-slate-400">Content Writer</div>
                                <div className="col-span-1 hidden md:block text-slate-400">$500 - $2,000</div>
                                <div className="col-span-1 text-slate-400 text-right">$2,000</div>
                                
                                <div className="col-span-2 md:col-span-1 text-slate-400">Review Management</div>
                                <div className="col-span-1 hidden md:block text-slate-400">$200 - $800</div>
                                <div className="col-span-1 text-slate-400 text-right">$800</div>
                                
                                <div className="col-span-3 h-px bg-slate-700 my-4"></div>
                                
                                <div className="col-span-2 md:col-span-1 text-white font-bold text-lg">Total Value</div>
                                <div className="col-span-1 hidden md:block text-white font-bold text-lg"></div>
                                <div className="col-span-1 text-white font-bold text-lg text-right">$10,800/mo</div>
                            </div>
                        </div>
                        
                        <div className="mt-12 text-center">
                            <h3 className="text-3xl font-bold text-white mb-4">Your Price: <span className="text-emerald-400">$149/mo</span></h3>
                            <p className="text-slate-400 text-lg">No Tool Lockouts. No "Leveling Up."</p>
                        </div>
                    </div>
                </section>
                
                {/* Final CTA */}
                <section className="py-24 bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <h2 className="text-4xl md:text-5xl font-bold mb-6">
                            Ready to Access All 20 Growth Tools?
                        </h2>
                        <p className="text-xl text-slate-300 mb-10">
                            Start your 7-day free trial now. Join 360+ local businesses growing with JetSuite.
                        </p>
                        
                        <a
                            href="https://getjetsuite.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-slate-900 font-bold text-lg hover:shadow-xl hover:shadow-white/20 transition-all duration-300 hover:scale-105"
                        >
                            Start 7-Day Free Trial
                        </a>
                        <p className="text-xs text-slate-400 mt-3">Credit card required. No charge during trial period. Cancel anytime.</p>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="py-20 bg-slate-900">
                    <div className="max-w-4xl mx-auto px-6">
                        <h2 className="text-3xl font-bold text-white mb-8">Frequently Asked Questions</h2>
                        <div className="space-y-2">
                            {faqs.map((faq, index) => (
                                <FAQItem key={index} question={faq.question} answer={faq.answer} index={index} />
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </ClientLayout>
    );
};

export default ClientJetSuitePage;