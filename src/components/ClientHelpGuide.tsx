import React from 'react';
import { MessageSquare, FileText, CalendarCheck, Zap, ArrowRight, CheckCircle2, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';

const ClientHelpGuide: React.FC = () => {
    const SectionTitle: React.FC<{ title: string, icon: React.ReactNode }> = ({ title, icon }) => (
        <h3 className="text-xl font-bold text-slate-900 mb-4 mt-8 flex items-center gap-2 border-b border-slate-100 pb-2">
            {icon} {title}
        </h3>
    );

    return (
        <div className="space-y-6">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
                <p className="font-bold mb-1">Welcome to Your Client Portal Help Center!</p>
                <p>Find quick guides on how to use the messaging system, manage files, and book appointments with our team.</p>
            </div>

            {/* Messaging Section */}
            <SectionTitle title="Project Messaging" icon={<MessageSquare className="w-5 h-5 text-indigo-600" />} />
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

            {/* Files Section */}
            <SectionTitle title="Files & Documents" icon={<FileText className="w-5 h-5 text-emerald-600" />} />
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

            {/* Appointments Section */}
            <SectionTitle title="Booking Appointments" icon={<CalendarCheck className="w-5 h-5 text-purple-600" />} />
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
            
            {/* JetSuite Section */}
            <SectionTitle title="JetSuite DIY Tools" icon={<Zap className="w-5 h-5 text-red-600" />} />
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-3">
                <Bot className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                    Access the full suite of AI tools via the <Link to="/client/jetsuite" className="font-bold text-red-600 hover:underline">JetSuite DIY</Link> link in the sidebar. Use tools like JetViz and Jet Local Optimizer to continuously monitor your website's performance and local SEO health.
                </p>
            </div>
        </div>
    );
};

export default ClientHelpGuide;