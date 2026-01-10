"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';
import { Settings, MessageSquare, Shield, ExternalLink, CheckCircle2, AlertTriangle, Mail, DollarSign, Zap, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

const SUPABASE_PROJECT_ID = "nvgumhlewbqynrhlkqhx";
const SUPABASE_SECRETS_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions/secrets`;

const AdminSettingsPage: React.FC = () => {
  
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-600" /> System Settings & Integrations
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Catalog Management Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Zap className="w-5 h-5 text-indigo-600" /> Add-on Catalog
            </h2>
            <p className="text-slate-600 mb-4 text-sm">
              Manage the list, pricing, and descriptions of all available AI and Customer Engagement add-ons.
            </p>
            <Link 
              to="/admin/addons/catalog" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Manage Catalog
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Integration Card: Resend API */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Send className="w-5 h-5 text-emerald-600" /> Resend API Configuration
            </h2>
            
            <p className="text-slate-600 mb-6">
              Configure your Resend API key for high-deliverability transactional emails. This is the preferred method over SMTP.
            </p>
            
            <Link 
              to="/admin/settings/resend" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Configure Resend API
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Integration Card: SMTP Email */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Mail className="w-5 h-5 text-indigo-600" /> Email (SMTP) Configuration
            </h2>
            
            <p className="text-slate-600 mb-6">
              Configure your external SMTP provider (e.g., SendGrid, Postmark, Gmail) to enable direct email sending from the system.
            </p>
            
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Encryption Key Required
                </h3>
                <p className="text-sm text-red-700">
                    For security, you must set the secret <code className="font-mono text-xs bg-red-200 px-1 rounded">SMTP_ENCRYPTION_KEY</code> in Supabase Secrets to encrypt SMTP passwords.
                </p>
            </div>

            <Link 
              to="/admin/settings/smtp" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Configure SMTP Settings
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Integration Card: Twilio SMS */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <MessageSquare className="w-5 h-5 text-emerald-600" /> Twilio SMS
            </h2>
            <p className="text-slate-600 mb-4 text-sm">
              Allows sending direct SMS messages to clients. Requires three secrets to be set in Supabase.
            </p>
            <Link 
              to="/admin/settings/twilio" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              View Twilio Setup
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
          {/* General Settings / Future Integrations */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <DollarSign className="w-5 h-5 text-purple-600" /> Billing Secrets
                </h3>
                <ul className="space-y-3 text-sm text-slate-600">
                    <li>• STRIPE_SECRET_KEY</li>
                    <li>• STRIPE_WEBHOOK_SECRET</li>
                    <li>• STRIPE_CUSTOMER_PORTAL_RETURN_URL</li>
                </ul>
                <p className="text-xs text-slate-400 mt-4">
                    These secrets are required for all Stripe API calls and webhooks.
                </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;