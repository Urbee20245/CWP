"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';
import { MessageSquare, ExternalLink, CheckCircle2, AlertTriangle, Settings, BookOpen, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import TwilioSetupGuide from '../components/TwilioSetupGuide'; // Import the new component

const SUPABASE_PROJECT_ID = "nvgumhlewbqynrhlkqhx";
const SUPABASE_SECRETS_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions/secrets`;

const AdminTwilioSettings: React.FC = () => {
  
  const requiredSecrets = [
    { name: 'TWILIO_ACCOUNT_SID', description: 'Your Twilio Account SID (starts with AC...)' },
    { name: 'TWILIO_AUTH_TOKEN', description: 'Your Twilio Auth Token' },
    { name: 'TWILIO_PHONE_NUMBER', description: 'Your Twilio sending number (e.g., +14045551234)' },
  ];
  
  // State to control which guide is visible (only Twilio for now)
  const [activeGuide, setActiveGuide] = React.useState<'twilio' | 'none'>('twilio');

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/admin/settings" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Settings
        </Link>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-emerald-600" /> Twilio SMS Integration Setup
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Configuration Details */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100 space-y-6 h-fit">
                
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" /> Action Required
                    </h3>
                    <p className="text-sm text-indigo-700">
                        Twilio credentials must be set as **Supabase Secrets** to ensure they are secure and only accessible by the Edge Function.
                    </p>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Settings className="w-5 h-5 text-slate-500" /> Required Secrets
                </h2>
                
                <p className="text-slate-600">
                    Please add the following three environment variables to your Supabase project secrets:
                </p>

                <div className="space-y-3">
                    {requiredSecrets.map((secret) => (
                        <div key={secret.name} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <code className="font-mono text-sm font-bold text-slate-900 block">{secret.name}</code>
                            <p className="text-xs text-slate-500 mt-1">{secret.description}</p>
                        </div>
                    ))}
                </div>
                
                <a 
                    href={SUPABASE_SECRETS_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-lg font-semibold hover:bg-emerald-700 transition-colors"
                >
                    Go to Supabase Secrets Console
                    <ExternalLink className="w-5 h-5" />
                </a>
                
                <div className="pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verification
                    </h3>
                    <p className="text-sm text-slate-600">
                        Once the secrets are set in Supabase, the SMS feature will automatically become active in the Admin Client Detail view.
                    </p>
                </div>
            </div>
            
            {/* Right Column: How-To Guide Panel */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Guide Navigation */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <BookOpen className="w-5 h-5 text-indigo-600" /> How To Guides
                    </h2>
                    
                    {/* Group: Phone Setup */}
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Phone Setup
                        </h3>
                        <button 
                            onClick={() => setActiveGuide('twilio')}
                            className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                                activeGuide === 'twilio' 
                                    ? 'bg-indigo-100 border border-indigo-300 text-indigo-700' 
                                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                        >
                            Twilio
                            {activeGuide === 'twilio' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                        </button>
                    </div>
                    
                    {/* Placeholder for other groups */}
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-700 mb-2">Billing Setup</h3>
                        <button 
                            onClick={() => setActiveGuide('none')}
                            className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                                activeGuide === 'none' 
                                    ? 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
                                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                        >
                            Stripe Integration
                        </button>
                    </div>
                </div>
                
                {/* Guide Content */}
                {activeGuide === 'twilio' && <TwilioSetupGuide />}
            </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTwilioSettings;