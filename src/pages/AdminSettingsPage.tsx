"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';
import { Settings, MessageSquare, Shield, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';

const AdminSettingsPage: React.FC = () => {
  
  // NOTE: We cannot read Deno environment variables (secrets) from the client side, 
  // so we provide instructions on where to set them.
  const twilioSecrets = [
    { name: 'TWILIO_ACCOUNT_SID', description: 'Your Twilio Account SID.' },
    { name: 'TWILIO_AUTH_TOKEN', description: 'Your Twilio Auth Token.' },
    { name: 'TWILIO_PHONE_NUMBER', description: 'Your Twilio phone number (e.g., +14045551234).' },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-600" /> System Settings & Integrations
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Integration Card: Twilio SMS */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <MessageSquare className="w-5 h-5 text-emerald-600" /> Twilio SMS Integration
            </h2>
            
            <p className="text-slate-600 mb-6">
              This integration allows you to send direct SMS messages to clients from their detail page. It requires secure configuration via Supabase Edge Function Secrets.
            </p>
            
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Configuration Required
                </h3>
                <p className="text-sm text-red-700">
                    The SMS feature will fail if the following secrets are not set in your Supabase project.
                </p>
            </div>

            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" /> Required Secrets
            </h3>
            
            <ul className="space-y-3 mb-6">
              {twilioSecrets.map((secret, index) => (
                <li key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <code className="font-mono text-sm font-bold text-slate-800">{secret.name}</code>
                  <p className="text-xs text-slate-500 mt-1">{secret.description}</p>
                </li>
              ))}
            </ul>
            
            <a 
              href="https://supabase.com/dashboard/project/nvgumhlewbqynrhlkqhx/functions/secrets" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Go to Supabase Secrets Manager
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          
          {/* General Settings / Future Integrations */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" /> Future Integrations
                </h3>
                <ul className="space-y-3 text-sm text-slate-600">
                    <li>• Google Gemini API Key</li>
                    <li>• Stripe Webhook Secret</li>
                    <li>• Vercel Deployment Hooks</li>
                </ul>
                <p className="text-xs text-slate-400 mt-4">
                    Use this page to manage all third-party connections as your application grows.
                </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;