import React from 'react';
import { Phone, CheckCircle2, AlertTriangle, ExternalLink, ChevronRight } from 'lucide-react';

const TwilioSetupGuide: React.FC = () => {
  const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <h3 className="text-lg font-bold text-slate-900 mb-3 mt-6 border-b border-slate-200 pb-2">{title}</h3>
  );

  const Step: React.FC<{ num: string, children: React.ReactNode }> = ({ num, children }) => (
    <li className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">{num}</div>
      <p className="text-sm text-slate-700 leading-relaxed">{children}</p>
    </li>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
        <Phone className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-900">Twilio Phone Number & A2P (10DLC) Setup Guide</h2>
      </div>

      <div className="p-3 mb-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
        <p className="font-bold mb-1">Purpose:</p>
        <p>This guide walks you through setting up a Twilio phone number that will be used by your AI customer service agent to answer calls, book appointments, and (optionally) send SMS confirmations and reminders.</p>
      </div>
      
      <div className="p-3 mb-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Important:</strong> A2P (10DLC) registration is required for SMS texting in the United States. Voice calls alone do not require A2P verification. If you want appointment confirmations or reminders via text message, you must complete A2P registration.
        </p>
      </div>

      <div className="space-y-6">
        
        <SectionTitle title="PART A — Create Your Twilio Account" />
        <ul className="space-y-4">
          <Step num="1">Go to <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">twilio.com</a> and create an account.</Step>
          <Step num="2">Verify your email address and phone number.</Step>
          <Step num="3">Log in to the Twilio Console and confirm your default project is active.</Step>
        </ul>

        <SectionTitle title="PART B — Upgrade Your Twilio Account" />
        <ul className="space-y-4">
          <Step num="1">In the Twilio Console, navigate to <strong>Billing</strong>.</Step>
          <Step num="2">Add a valid credit or debit card.</Step>
          <Step num="3">Complete your billing profile so your account is fully enabled.</Step>
        </ul>

        <SectionTitle title="PART C — Purchase a Twilio Phone Number" />
        <ul className="space-y-4">
          <Step num="1">Go to <strong>Phone Numbers → Manage → Buy a Number</strong>.</Step>
          <Step num="2">Select <strong>United States</strong> as the country.</Step>
          <Step num="3">Enable <strong>Voice</strong> (required) and <strong>SMS</strong> (optional but recommended).</Step>
          <Step num="4">Choose a local or toll-free number and complete the purchase.</Step>
        </ul>

        <SectionTitle title="PART D — Register for A2P (10DLC) Messaging" />
        <ul className="space-y-4">
          <Step num="1">In Twilio Console, go to <strong>Messaging → Regulatory Compliance → A2P 10DLC</strong>.</Step>
          <Step num="2">Create a <strong>Business Profile</strong> using your legal business information.</Step>
          <Step num="3">Create a <strong>Messaging Campaign</strong> describing your use case.</Step>
          <Step num="4">Provide an example message such as: <br/>
            <code className="block mt-2 p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono">
              “Hi {'{{Name}}'}, your appointment is confirmed for {'{{Date}}'} at {'{{Time}}'}. Reply STOP to opt out.”
            </code>
          </Step>
        </ul>

        <SectionTitle title="PART E — Approval Timeline" />
        <ul className="list-disc list-inside ml-4 space-y-2 text-sm text-slate-700">
          <li>Brand registration typically takes 1–3 business days.</li>
          <li>Campaign approval usually takes 1–5 business days.</li>
          <li>Once approved, SMS messaging will be fully enabled.</li>
        </ul>
        
        <SectionTitle title="PART F — Next Steps with Custom Websites Plus" />
        <p className="text-sm text-slate-700">
          Once your Twilio number and A2P campaign are approved, Custom Websites Plus will connect your number to your AI phone agent. The agent will answer calls, book appointments directly to your calendar, and send confirmations automatically.
        </p>
      </div>
    </div>
  );
};

export default TwilioSetupGuide;