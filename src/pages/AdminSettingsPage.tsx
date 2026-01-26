"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';
import { Settings, MessageSquare, Shield, ExternalLink, CheckCircle2, AlertTriangle, Mail, DollarSign, Zap, Users } from 'lucide-react';
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

        <div className="grid grid-cols-1 lg:col-span-3 lg:grid-cols-3 gap-8">
          
          {/* User Management Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Users className="w-5 h-5 text-indigo-600" /> User Access Control
            </h2>
            <p className="text-slate-600 mb-4 text-sm">
              Manage roles and granular module access for all admin and project manager accounts.
            </p>
            <Link 
              to="/admin/users" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Manage Users
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
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
          
          {/* NEW: Email Inbox Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Mail className="w-5 h-5 text-indigo-600" /> Email Inbox
            </h2>
            <p className="text-slate-600 mb-4 text-sm">
              View all incoming client messages and sent email logs in one place.
            </p>
            <Link 
              to="/admin/inbox" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              View Inbox
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Integration Card: Resend Email (Now lg:col-span-2) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Mail className="w-5 h-5 text-emerald-600" /> Email (Resend) Configuration
            </h2>
            
            <p className="text-slate-600 mb-6">
              The system now uses the Resend API for all email sending (public forms and admin notifications).
            </p>
            
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
                <h3 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Configuration Required
                </h3>
                <p className="text-sm text-emerald-700">
                    You must set the secret <code className="font-mono text-xs bg-emerald-200 px-1 rounded">RESEND_API_KEY</code> in Supabase Secrets.
                    <br/>
                    Also set <code className="font-mono text-xs bg-emerald-200 px-1 rounded">SMTP_FROM_EMAIL</code> and <code className="font-mono text-xs bg-emerald-200 px-1 rounded">SMTP_FROM_NAME</code> for the sender identity.
                </p>
            </div>

            <a 
              href={`https://supabase.com/dashboard/project/nvgumhlewbqynrhlkqhx/functions/secrets`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Go to Supabase Secrets
              <ExternalLink className="w-4 h-4" />
            </a>
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