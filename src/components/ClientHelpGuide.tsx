import React, { useState, useMemo } from 'react';
import { MessageSquare, FileText, CalendarCheck, Zap, ArrowRight, CheckCircle2, Bot, Phone, ChevronDown, ChevronUp, DollarSign, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HelpItem {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
    keywords: string;
}

interface ClientHelpGuideProps {
    filter: string;
}

const ClientHelpGuide: React.FC<ClientHelpGuideProps> = ({ filter }) => {
    const [openSectionId, setOpenSectionId] = useState<string | null>(null);
    
    const helpItems: HelpItem[] = useMemo(() => [
        // 1. Messaging Section
        {
            id: 'messaging',
            title: 'Project Messaging',
            icon: <MessageSquare className="w-5 h-5 text-indigo-600" />,
            content: (
                <ul className="space-y-4 text-sm text-slate-700">
                    <li>
                        <p className="font-semibold">1. How to Start a New Discussion</p>
                        <p className="ml-4 mt-1">Navigate to your project detail page, select the 'Messages' tab, and use the "New Thread" button at the bottom. Give your thread a clear title (e.g., "Feedback on Design Mockups").</p>
                    </li>
                    <li>
                        <p className="font-semibold">2. Who sees my messages?</p>
                        <p className="ml-4 mt-1">All messages in a project thread are seen by your dedicated Project Manager and relevant CWP team members (designers, developers).</p>
                    </li>
                    <li>
                        <p className="font-semibold">3. What if a thread is closed?</p>
                        <p className="ml-4 mt-1">Closed threads are for historical reference. If you have a new topic, please start a new thread to ensure it gets immediate attention.</p>
                    </li>
                </ul>
            ),
            keywords: 'message chat thread discussion communication project manager',
        },
        // 2. Files Section
        {
            id: 'files',
            title: 'Files & Documents',
            icon: <FileText className="w-5 h-5 text-emerald-600" />,
            content: (
                <ul className="space-y-4 text-sm text-slate-700">
                    <li>
                        <p className="font-semibold">1. Uploading Files</p>
                        <p className="ml-4 mt-1">In the 'Files' tab of your project, use the upload form to share logos, brand guidelines, content drafts, or any other necessary assets with our team.</p>
                    </li>
                    <li>
                        <p className="font-semibold">2. Shared Documents</p>
                        <p className="ml-4 mt-1">The 'Documents' tab contains important legal drafts (like Terms & Conditions) and strategy documents shared by the admin team for your review.</p>
                    </li>
                </ul>
            ),
            keywords: 'files documents upload download legal terms conditions assets logo',
        },
        // 3. Appointments Section
        {
            id: 'appointments',
            title: 'Booking Appointments',
            icon: <CalendarCheck className="w-5 h-5 text-purple-600" />,
            content: (
                <ul className="space-y-4 text-sm text-slate-700">
                    <li>
                        <p className="font-semibold">1. How to Book a Call</p>
                        <p className="ml-4 mt-1">Go to the <Link to="/client/appointments" className="text-purple-600 hover:underline">Appointments</Link> page. Select an available time slot from the calendar and choose your preferred meeting type (Phone or Video).</p>
                    </li>
                    <li>
                        <p className="font-semibold">2. AI Voice Agent</p>
                        <p className="ml-4 mt-1">Our Luna AI Voice Agent is available 24/7 to answer general questions and capture leads outside of business hours. For project-specific discussions, please use the portal messaging or book a call.</p>
                    </li>
                </ul>
            ),
            keywords: 'appointments booking calendar call video phone luna ai voice agent',
        },
        // 4. JetSuite Section
        {
            id: 'jetsuite',
            title: 'JetSuite DIY Tools',
            icon: <Zap className="w-5 h-5 text-red-600" />,
            content: (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-3">
                    <Bot className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>
                        Access the full suite of AI tools via the <Link to="/client/jetsuite" className="font-bold text-red-600 hover:underline">JetSuite DIY</Link> link in the sidebar. Use tools like JetViz and Jet Local Optimizer to continuously monitor your website's performance and local SEO health.
                    </p>
                </div>
            ),
            keywords: 'jetsuite diy tools optimizer jetviz seo audit performance',
        },
        // 5. NEW TWILIO SETUP GUIDE
        {
            id: 'twilio-setup',
            title: 'Twilio Phone Number & A2P (10DLC) Setup',
            icon: <Phone className="w-5 h-5 text-indigo-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                        <p className="font-bold">Important A2P Note:</p>
                        <p>A2P (10DLC) registration is required for SMS texting in the United States. Voice calls alone do not require A2P verification. If you want appointment confirmations or reminders via text message, you must complete A2P registration.</p>
                    </div>

                    <h4 className="font-bold text-slate-900">PART A — Create Your Twilio Account</h4>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Go to <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">twilio.com</a> and create an account.</li>
                        <li>Verify your email address and phone number.</li>
                        <li>Log in to the Twilio Console and confirm your default project is active.</li>
                    </ul>

                    <h4 className="font-bold text-slate-900">PART B — Upgrade Your Twilio Account</h4>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>In the Twilio Console, navigate to Billing.</li>
                        <li>Add a valid credit or debit card.</li>
                        <li>Complete your billing profile so your account is fully enabled.</li>
                    </ul>

                    <h4 className="font-bold text-slate-900">PART C — Purchase a Twilio Phone Number</h4>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Go to Phone Numbers &rarr; Manage &rarr; Buy a Number.</li>
                        <li>Select United States as the country.</li>
                        <li>Enable Voice (required) and SMS (optional but recommended).</li>
                        <li>Choose a local or toll-free number and complete the purchase.</li>
                    </ul>

                    <h4 className="font-bold text-slate-900">PART D — Register for A2P (10DLC) Messaging</h4>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>In Twilio Console, go to Messaging &rarr; Regulatory Compliance &rarr; A2P 10DLC.</li>
                        <li>Create a Business Profile using your legal business information.</li>
                        <li>Create a Messaging Campaign describing your use case.</li>
                        <li>Provide an example message such as: “Hi {'{{Name}}'}, your appointment is confirmed for {'{{Date}}'} at {'{{Time}}'}. Reply STOP to opt out.”</li>
                    </ul>

                    <h4 className="font-bold text-slate-900">PART E — Approval Timeline</h4>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Brand registration typically takes 1–3 business days.</li>
                        <li>Campaign approval usually takes 1–5 business days.</li>
                        <li>Once approved, SMS messaging will be fully enabled.</li>
                    </ul>

                    <h4 className="font-bold text-slate-900">PART F — Next Steps with Custom Websites Plus</h4>
                    <p>Once your Twilio number and A2P campaign are approved, please share your **Account SID** and **Auth Token** with your CWP Project Manager. We will then connect your number to your AI phone agent. The agent will answer calls, book appointments directly to your calendar, and send confirmations automatically.</p>
                </div>
            ),
            keywords: 'twilio setup a2p 10dlc phone number voice sms billing purchase regulatory compliance',
        },
    ], []);

    const filteredItems = useMemo(() => {
        if (!filter) return helpItems;
        const lowerCaseFilter = filter.toLowerCase();
        return helpItems.filter(item => 
            item.title.toLowerCase().includes(lowerCaseFilter) || 
            item.keywords.includes(lowerCaseFilter)
        );
    }, [filter, helpItems]);

    const toggleSection = (id: string) => {
        setOpenSectionId(openSectionId === id ? null : id);
    };

    return (
        <div className="space-y-4">
            {filteredItems.length === 0 && (
                <div className="p-8 bg-slate-100 rounded-xl text-center text-slate-600">
                    No results found for "{filter}".
                </div>
            )}
            {filteredItems.map((item) => {
                const isOpen = openSectionId === item.id;
                return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
                        <button
                            onClick={() => toggleSection(item.id)}
                            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {item.icon}
                                <span className="font-bold text-lg text-slate-900 pr-4">{item.title}</span>
                            </div>
                            {isOpen ? (
                                <ChevronUp className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                            ) : (
                                <ChevronDown className="w-6 h-6 text-slate-400 flex-shrink-0" />
                            )}
                        </button>
                        {isOpen && (
                            <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                                {item.content}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ClientHelpGuide;