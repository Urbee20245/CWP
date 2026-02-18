import React, { useState, useMemo } from 'react';
import { MessageSquare, FileText, CalendarCheck, Zap, CheckCircle2, Bot, Phone, ChevronDown, ChevronUp, DollarSign, Calendar, AlertTriangle, Key } from 'lucide-react';
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
        // 4. NEW Google Calendar Guide
        {
            id: 'google-calendar',
            title: 'Google Calendar: Automated Appointment Booking',
            icon: <Calendar className="w-5 h-5 text-blue-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <h4 className="font-bold text-slate-900">What does this integration do?</h4>
                    <p>Connecting your Google Calendar allows our system to automatically create events in your calendar when a new consultation is requested through your website's contact form. This eliminates manual entry and ensures you never miss a new lead.</p>

                    <h4 className="font-bold text-slate-900">How to Connect Your Calendar</h4>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>Navigate to the <Link to="/client/settings" className="text-blue-600 hover:underline font-semibold">Settings</Link> page from the sidebar.</li>
                        <li>Find the "Google Calendar Integration" section.</li>
                        <li>Click the **"Connect Google Calendar"** button.</li>
                    </ol>

                    <h4 className="font-bold text-slate-900">The Authentication Process</h4>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>You will be redirected to a secure Google sign-in page.</li>
                        <li>Choose the Google account associated with your business calendar.</li>
                        <li>Grant the requested permissions. We only ask for permission to create and manage events. We cannot see your other events or personal data.</li>
                        <li>After granting permission, you will be automatically redirected back to your CWP Settings page.</li>
                    </ol>

                    <h4 className="font-bold text-slate-900">After Connecting</h4>
                    <p>Once connected, you will see a "Connected" status in your Settings. New appointments from your website form will now appear on your calendar automatically.</p>
                    
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                        <p className="font-bold">Troubleshooting:</p>
                        <p>If the connection fails or you encounter an error, please contact your project manager for assistance.</p>
                    </div>
                </div>
            ),
            keywords: 'google calendar integration connect sync appointments booking automation oauth',
        },
        // 5. JetSuite Section
        {
            id: 'jetsuite',
            title: 'JetSuite Tools',
            icon: <Zap className="w-5 h-5 text-red-600" />,
            content: (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-3">
                    <Bot className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>
                        Access the full suite of AI tools via the <Link to="/client/jetsuite" className="font-bold text-red-600 hover:underline">JetSuite</Link> link in the sidebar. Use tools like JetViz and Jet Local Optimizer to continuously monitor your website's performance and local SEO health.
                    </p>
                </div>
            ),
            keywords: 'jetsuite tools optimizer jetviz seo audit performance',
        },
        
        // 6. TWILIO CREDENTIALS SECTION (Extracted)
        {
            id: 'twilio-credentials',
            title: 'Twilio: Accessing Credentials (SID & Token)',
            icon: <Phone className="w-5 h-5 text-indigo-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <h4 className="font-bold text-slate-900">Video Guide: Finding Your Account SID and Auth Token</h4>
                    <div className="space-y-4">
                        <div className="aspect-video w-full rounded-lg overflow-hidden shadow-lg">
                            <iframe 
                                width="100%" 
                                height="100%" 
                                src="https://www.youtube.com/embed/ADDeIBbQwHk" 
                                title="How to Access Twilio Credentials" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                        </div>
                        <h4 className="font-bold text-slate-900">Step-by-Step Instructions</h4>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Log in to your Twilio Console.</li>
                            <li>The **Account SID** (starts with AC...) and **Auth Token** will be displayed on the main dashboard.</li>
                            <li>Click the **View** button next to the Auth Token to reveal it.</li>
                            <li>You will need both of these values, along with your purchased phone number, to complete the integration in your CWP profile.</li>
                        </ul>
                    </div>
                </div>
            ),
            keywords: 'twilio credentials sid token auth authentication login',
        },
        
        // 7. TWILIO A2P SETUP GUIDE (Modified to start at Part A)
        {
            id: 'twilio-setup',
            title: 'Twilio: Phone Number & A2P (10DLC) Setup',
            icon: <Phone className="w-5 h-5 text-indigo-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Important A2P Note:</p>
                            <p>A2P (10DLC) registration is required for SMS texting in the United States. Voice calls alone do not require A2P verification. If you want appointment confirmations or reminders via text message, you must complete A2P registration.</p>
                        </div>
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
                        <li>Provide an example message such as: "Hi {'{{Name}}'}, your appointment is confirmed for {'{{Date}}'} at {'{{Time}}'}. Reply STOP to opt out."</li>
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
            keywords: 'twilio setup a2p 10dlc phone number voice sms billing purchase regulatory compliance credentials sid auth token',
        },
        
        // NEW: Cal.com Account Creation Guide
        {
            id: 'calcom-signup',
            title: 'Cal.com: How to Create Your Account',
            icon: <Calendar className="w-5 h-5 text-emerald-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-emerald-800">Cal.com is 100% Free</p>
                            <p className="text-emerald-700 mt-0.5">The free plan includes unlimited event types, calendar sync, and all the features you need to get started with AI booking.</p>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-900">Step 1 — Create Your Account</h4>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>Visit <a href="https://app.cal.com/signup" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-semibold">app.cal.com/signup</a></li>
                        <li>Enter your name, email address, and create a password.</li>
                        <li>Choose a username — this becomes your public booking link (e.g., <code className="bg-slate-100 px-1 rounded text-xs">cal.com/your-name</code>).</li>
                        <li>Click <strong>Create Account</strong> and verify your email.</li>
                    </ol>

                    <h4 className="font-bold text-slate-900">Step 2 — Connect Your Calendar</h4>
                    <p>After logging in, Cal.com will prompt you to connect a calendar. This is required so Cal.com knows when you're available.</p>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>Click <strong>"Connect a Calendar"</strong> and select Google Calendar or Outlook.</li>
                        <li>Complete the Google/Outlook authorization flow.</li>
                        <li>Once connected, Cal.com will automatically block off times when you're busy.</li>
                    </ol>

                    <h4 className="font-bold text-slate-900">Step 3 — Set Your Availability</h4>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>In the left sidebar, click <strong>"Availability"</strong>.</li>
                        <li>Configure your working hours (e.g., Mon–Fri, 9am–5pm).</li>
                        <li>Set your time zone — this is critical for accurate booking.</li>
                        <li>Click <strong>"Save"</strong>.</li>
                    </ol>

                    <h4 className="font-bold text-slate-900">Step 4 — Create an Event Type</h4>
                    <p>An event type defines the meeting format clients can book with you.</p>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>Click <strong>"Event Types"</strong> in the sidebar.</li>
                        <li>Click <strong>"New Event Type"</strong> and select <strong>"One-on-One"</strong>.</li>
                        <li>Set the title (e.g., "15-Minute Consultation"), duration (15 min), and location (Phone or Google Meet).</li>
                        <li>Click <strong>"Create"</strong>.</li>
                        <li>Note the URL — the number in it is your <strong>Event Type ID</strong> (you'll need this for your CWP integration).</li>
                    </ol>

                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <p className="font-bold text-indigo-800 mb-1">📌 Finding Your Event Type ID</p>
                        <p className="text-indigo-700 text-xs">After creating your event type, open it and look at the URL bar. It will look like: <code className="bg-indigo-100 px-1 rounded">app.cal.com/event-types/<strong>123456</strong></code>. The number is your ID — copy it and paste it into your CWP Integrations settings.</p>
                    </div>

                    <h4 className="font-bold text-slate-900">Step 5 — Connect Cal.com in CWP</h4>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>Go to <Link to="/client/settings" className="text-indigo-600 hover:underline font-semibold">Integrations</Link> in your CWP portal.</li>
                        <li>Open the <strong>"Calendar Booking"</strong> section.</li>
                        <li>Under Cal.com, click <strong>"Connect Cal.com"</strong> (OAuth) or enter your API key.</li>
                        <li>Enter your Event Type ID in the field provided.</li>
                        <li>Click <strong>"Save"</strong>. You're done!</li>
                    </ol>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                        <p className="font-bold">Need help?</p>
                        <p className="text-xs mt-1">If you get stuck at any step, contact your project manager or visit <a href="https://cal.com/docs" target="_blank" rel="noopener noreferrer" className="underline">cal.com/docs</a>.</p>
                    </div>
                </div>
            ),
            keywords: 'cal.com signup create account calendar setup free booking availability event type id',
        },

        // Cal.com Integration Guide (existing)
        {
            id: 'calcom-integration',
            title: 'Cal.com: Connect & Event Type ID',
            icon: <Calendar className="w-5 h-5 text-indigo-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <h4 className="font-bold text-slate-900">What does this integration do?</h4>
                    <p>Connecting Cal.com lets your AI assistant (including Retell AI voice agents) check availability and book meetings directly into your Cal.com account. You can connect using either OAuth (automatic) or an API Key (manual).</p>

                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800">
                        <p className="font-bold flex items-center gap-2"><Key className="w-4 h-4" /> Two Connection Methods</p>
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                            <li><strong>OAuth (Recommended):</strong> Click "Connect Cal.com" for automatic setup with token refresh.</li>
                            <li><strong>API Key:</strong> Manual setup ideal for Retell AI and other third-party integrations.</li>
                        </ul>
                    </div>

                    <h4 className="font-bold text-slate-900">Option 1: Connect via OAuth</h4>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                        <li>Go to <Link to="/client/settings" className="text-indigo-600 hover:underline font-semibold">Settings</Link>.</li>
                        <li>Find the "Cal.com Integration" section.</li>
                        <li>Click "Connect Cal.com" and complete the secure authorization flow.</li>
                    </ol>

                    <h4 className="font-bold text-slate-900">Option 2: Connect via API Key</h4>
                    <p>Use this method for Retell AI integration or when OAuth isn't available:</p>

                    <div className="ml-4 space-y-4 mt-3">
                        <div>
                            <p className="font-semibold text-slate-800">Step 1: Log into Cal.com</p>
                            <p className="ml-4 mt-1">Go to <a href="https://app.cal.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">app.cal.com</a> and sign in to your account.</p>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 2: Navigate to API Keys</p>
                            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                <li>Click on your <strong>Profile Picture</strong> (top-right corner).</li>
                                <li>Select <strong>"Settings"</strong> from the dropdown menu.</li>
                                <li>In the left sidebar, scroll down and click <strong>"API Keys"</strong> (under the Developer section).</li>
                            </ul>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 3: Create a New API Key</p>
                            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                <li>Click the <strong>"+ New"</strong> button.</li>
                                <li>Give your key a descriptive name (e.g., "CWP Integration" or "Retell AI").</li>
                                <li>Optionally set an expiration date (or leave blank for no expiration).</li>
                                <li>Click <strong>"Create"</strong>.</li>
                            </ul>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 4: Copy Your API Key</p>
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 mt-2">
                                <p className="font-bold">Important:</p>
                                <p>Copy the API key immediately! It will only be shown once. If you lose it, you'll need to create a new one.</p>
                            </div>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 5: Enter the API Key in CWP</p>
                            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                <li>Go to <Link to="/client/settings" className="text-indigo-600 hover:underline font-semibold">Settings</Link> in your CWP dashboard.</li>
                                <li>Find the "Cal.com Integration" section.</li>
                                <li>Click <strong>"Use API Key Instead"</strong>.</li>
                                <li>Paste your API key into the input field.</li>
                                <li>Click <strong>"Validate & Save"</strong> to confirm the connection.</li>
                            </ul>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <span>Finding Your Event Type ID</span>
                    </h4>
                    <p>The Event Type ID tells the system which meeting type to use when booking appointments. This is required for both OAuth and API Key connections.</p>

                    <div className="ml-4 space-y-4 mt-3">
                        <div>
                            <p className="font-semibold text-slate-800">Step 1: Go to Event Types</p>
                            <p className="ml-4 mt-1">In Cal.com, click <strong>"Event Types"</strong> in the left sidebar to see all your meeting types.</p>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 2: Select Your Event Type</p>
                            <p className="ml-4 mt-1">Click on the event type you want to use for AI-booked appointments (e.g., "15 Minute Meeting" or "Consultation Call").</p>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 3: Find the Event Type ID</p>
                            <p className="ml-4 mt-1">Look at your browser's URL bar. The URL will look like:</p>
                            <code className="block bg-slate-100 p-2 rounded mt-2 text-xs">https://app.cal.com/event-types/<strong className="text-indigo-600">123456</strong>?tabName=setup</code>
                            <p className="ml-4 mt-2">The number after <code>/event-types/</code> is your <strong>Event Type ID</strong> (in this example: <strong>123456</strong>).</p>
                        </div>

                        <div>
                            <p className="font-semibold text-slate-800">Step 4: Save the Event Type ID</p>
                            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                <li>Copy the numeric ID from the URL.</li>
                                <li>In CWP <Link to="/client/settings" className="text-indigo-600 hover:underline">Settings</Link>, paste it into the <strong>"Default Event Type ID"</strong> field.</li>
                                <li>Click <strong>"Save"</strong> to confirm.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                        <p className="font-bold">For Retell AI & Other Integrations:</p>
                        <p className="mt-1">Once you have your API Key and Event Type ID saved in CWP, your Retell AI voice agent will automatically use these credentials to check availability and book appointments on your behalf. No additional configuration is needed in Retell—everything is managed through your CWP settings.</p>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                        <p className="font-bold">Troubleshooting:</p>
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                            <li>If Cal.com shows "needs re-authorization," click "Reconnect Cal.com" in Settings.</li>
                            <li>If API Key validation fails, ensure you copied the full key without extra spaces.</li>
                            <li>If bookings fail, verify your Event Type ID is correct and the event type is active.</li>
                        </ul>
                    </div>
                </div>
            ),
            keywords: 'cal cal.com integration connect event type id booking availability api key retell ai oauth',
        },

        // NEW: Appointment Fees & Payments
        {
            id: 'appointment-fees',
            title: 'Appointment Fees & Payments',
            icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
            content: (
                <div className="space-y-6 text-sm text-slate-700">
                    <h4 className="font-bold text-slate-900">When are fees required?</h4>
                    <p>Some appointment types may include a booking fee. If a fee applies, you'll see the price before confirming the meeting.</p>

                    <h4 className="font-bold text-slate-900">How payment works</h4>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Fees are processed securely via Stripe.</li>
                        <li>You'll receive a hosted invoice or payment link to complete checkout.</li>
                        <li>A receipt is automatically emailed after successful payment.</li>
                    </ul>

                    <h4 className="font-bold text-slate-900">Where to view invoices</h4>
                    <p>Open <Link to="/client/billing" className="text-emerald-600 hover:underline font-semibold">Client Billing</Link> to view paid and outstanding invoices.</p>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="font-bold text-slate-900">Tips</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>If you need to cancel or reschedule a paid booking, contact your Project Manager.</li>
                            <li>For troubleshooting payment links or receipts, check your email spam folder first.</li>
                        </ul>
                    </div>
                </div>
            ),
            keywords: 'appointments fees payment stripe invoice billing paid booking',
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