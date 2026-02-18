"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  Settings, MessageSquare, Shield, ExternalLink, CheckCircle2, AlertTriangle,
  Mail, DollarSign, Zap, Users, Bot, Calendar, Loader2, ShieldCheck, Save,
  CheckCircle, Key, Globe, Link2, Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import ClientCalComIntegration from '../components/ClientCalComIntegration';
import { ClientIntegrationService } from '../services/clientIntegrationService';

interface CalStatus {
  connection_status: 'connected' | 'disconnected' | 'needs_reauth';
  refresh_token_present?: boolean;
  auth_method?: 'oauth' | 'api_key';
}

const SUPABASE_PROJECT_ID = "nvgumhlewbqynrhlkqhx";
const SUPABASE_SECRETS_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions/secrets`;
const CAL_OAUTH_REDIRECT_URI = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cal-oauth-callback`;

type TabId = 'integrations' | 'security' | 'billing' | 'access';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'billing', label: 'Billing & Secrets', icon: DollarSign },
  { id: 'access', label: 'Access & Users', icon: Users },
];

const AdminSettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('integrations');
  const [adminClientId, setAdminClientId] = useState<string | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [calStatus, setCalStatus] = useState<CalStatus | null>(null);
  const [isLoadingCalStatus, setIsLoadingCalStatus] = useState(true);

  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('');
  const [recaptchaSaved, setRecaptchaSaved] = useState(false);
  const [recaptchaSaving, setRecaptchaSaving] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);

  const fetchCalStatus = useCallback(async (clientId: string) => {
    setIsLoadingCalStatus(true);
    try {
      const status = await ClientIntegrationService.getCalComStatus(clientId);
      setCalStatus(status as CalStatus | null);
    } catch (err) {
      console.error('Failed to fetch Cal.com status:', err);
      setCalStatus(null);
    } finally {
      setIsLoadingCalStatus(false);
    }
  }, []);

  const fetchAdminClient = useCallback(async () => {
    if (!profile) return;
    setIsLoadingClient(true);
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .maybeSingle();

      if (clientData) {
        setAdminClientId(clientData.id);
        fetchCalStatus(clientData.id);
      } else {
        const { data: newClient, error: createError } = await supabase
          .from('clients')
          .insert({
            owner_profile_id: profile.id,
            business_name: 'Custom Websites Plus',
            status: 'active',
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Failed to create admin client:', createError);
        } else if (newClient) {
          setAdminClientId(newClient.id);
          fetchCalStatus(newClient.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin client:', err);
    } finally {
      setIsLoadingClient(false);
    }
  }, [profile, fetchCalStatus]);

  useEffect(() => {
    if (profile) fetchAdminClient();
  }, [profile, fetchAdminClient]);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'recaptcha_site_key')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setRecaptchaSiteKey(data.value);
      });
  }, []);

  const handleSaveRecaptcha = async () => {
    setRecaptchaSaving(true);
    setRecaptchaError(null);
    setRecaptchaSaved(false);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({ key: 'recaptcha_site_key', value: recaptchaSiteKey }, { onConflict: 'key' });
      if (error) throw error;
      setRecaptchaSaved(true);
      setTimeout(() => setRecaptchaSaved(false), 3000);
    } catch (err: any) {
      setRecaptchaError(err.message || 'Failed to save');
    } finally {
      setRecaptchaSaving(false);
    }
  };

  const CalStatusBadge = () => {
    if (isLoadingCalStatus) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking...
        </span>
      );
    }
    if (calStatus?.connection_status === 'connected' && (calStatus?.auth_method === 'api_key' || calStatus?.refresh_token_present)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Connected{calStatus?.auth_method === 'api_key' ? ' (API Key)' : ''}
        </span>
      );
    }
    if (calStatus?.connection_status === 'needs_reauth') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> Needs Reconnection
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <Calendar className="w-3 h-3" /> Not Connected
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage integrations, security keys, and platform configuration.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Integrations */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">

            {/* Cal.com */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Cal.com Integration</h2>
                    <p className="text-xs text-slate-500">Appointment scheduling and availability</p>
                  </div>
                </div>
                <CalStatusBadge />
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Connect Your Account</h3>
                    {isLoadingClient ? (
                      <div className="flex items-center justify-center h-24">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      </div>
                    ) : adminClientId ? (
                      <ClientCalComIntegration
                        clientId={adminClientId}
                        isAdminView={true}
                        onStatusChange={() => fetchCalStatus(adminClientId)}
                      />
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-amber-800 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          No client record found. Please refresh.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Setup Instructions</h3>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Required Supabase Secrets</p>
                      <div className="flex flex-col gap-2">
                        <code className="text-xs bg-slate-200 text-slate-800 px-2 py-1 rounded font-mono">CAL_CLIENT_ID</code>
                        <code className="text-xs bg-slate-200 text-slate-800 px-2 py-1 rounded font-mono">CAL_CLIENT_SECRET</code>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 mb-2">OAuth Redirect URI</p>
                      <code className="block text-[11px] text-slate-700 font-mono break-all bg-white border border-slate-200 rounded p-2">{CAL_OAUTH_REDIRECT_URI}</code>
                    </div>
                    <a
                      href={SUPABASE_SECRETS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Open Supabase Secrets
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Email (Resend) */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Email Configuration (Resend)</h2>
                  <p className="text-xs text-slate-500">Transactional email for forms and notifications</p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 mb-4">
                      All outgoing email uses the Resend API. Set the following secrets in Supabase for email to function.
                    </p>
                    <a
                      href={SUPABASE_SECRETS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Open Supabase Secrets
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Required Secrets</p>
                    {['RESEND_API_KEY', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'].map(secret => (
                      <code key={secret} className="block text-xs bg-white border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded font-mono">
                        {secret}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Twilio SMS */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Twilio SMS</h2>
                    <p className="text-xs text-slate-500">Direct SMS messaging to clients</p>
                  </div>
                </div>
                <Link
                  to="/admin/settings/twilio"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Configure
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-slate-600">Requires three Supabase secrets. Click Configure to view the full setup guide.</p>
              </div>
            </div>

            {/* Retell AI */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Retell AI (Voice)</h2>
                    <p className="text-xs text-slate-500">AI-powered call handling per client</p>
                  </div>
                </div>
                <Link
                  to="/admin/voice"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Manage
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 mb-4">Each client gets their own custom Retell agent for personalized call handling.</p>
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">Required Secret</p>
                      <code className="text-xs font-mono text-indigo-800 bg-indigo-100 px-2 py-1 rounded">RETELL_API_KEY</code>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Setup Flow</p>
                    <ol className="space-y-2">
                      {[
                        'Client enters Twilio credentials in their Settings',
                        'You see "Twilio" badge on AI Call Management',
                        'Create a custom Retell Agent in Retell Dashboard',
                        'Enter client\'s Retell Agent ID',
                        'Click "Enable AI Call Handling"',
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Security */}
        {activeTab === 'security' && (
          <div className="space-y-6">

            {/* reCAPTCHA */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Google reCAPTCHA v3</h2>
                  <p className="text-xs text-slate-500">Protects all client contact forms across hosted sites</p>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Site Key <span className="text-slate-400 font-normal text-xs">(public — stored in database)</span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={recaptchaSiteKey}
                      onChange={e => setRecaptchaSiteKey(e.target.value)}
                      placeholder="6Le..."
                      className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                    <button
                      onClick={handleSaveRecaptcha}
                      disabled={recaptchaSaving}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                        recaptchaSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {recaptchaSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : recaptchaSaved ? (
                        <><CheckCircle className="w-4 h-4" /> Saved!</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save</>
                      )}
                    </button>
                  </div>
                  {recaptchaError && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {recaptchaError}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-600" /> Secret Key (server-side)
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Add your reCAPTCHA v3 secret key as a Supabase Edge Function secret. Used by the <code className="font-mono text-xs bg-slate-200 px-1 rounded">public-contact-form</code> function to verify submissions.
                  </p>
                  <code className="block text-xs font-mono bg-white border border-slate-200 text-slate-800 px-2.5 py-2 rounded mb-3">RECAPTCHA_SECRET_KEY</code>
                  <a
                    href={SUPABASE_SECRETS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Open Supabase Secrets
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <p className="text-xs text-slate-400">
                  Get your keys at <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">google.com/recaptcha/admin</a>. Select <strong>reCAPTCHA v3</strong> and add all your client domains.
                </p>
              </div>
            </div>

            {/* Encryption Key */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Data Encryption Key</h2>
                  <p className="text-xs text-slate-500">Encrypts sensitive client credentials at rest</p>
                </div>
              </div>
              <div className="p-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <code className="block font-mono text-sm text-red-800 mb-2">SMTP_ENCRYPTION_KEY</code>
                  <p className="text-xs text-red-700">Used to encrypt/decrypt client Twilio credentials. Must be 32+ characters. Set in Supabase Secrets.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Billing & Secrets */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Stripe Billing Secrets</h2>
                  <p className="text-xs text-slate-500">Required for all Stripe API calls and webhooks</p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 mb-4">
                      These secrets must be set in Supabase Edge Function secrets to enable Stripe billing, invoicing, and the customer portal.
                    </p>
                    <a
                      href={SUPABASE_SECRETS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Open Supabase Secrets
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Required Secrets</p>
                    {['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CUSTOMER_PORTAL_RETURN_URL'].map(secret => (
                      <code key={secret} className="block text-xs bg-white border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded font-mono">
                        {secret}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Access & Users */}
        {activeTab === 'access' && (
          <div className="space-y-6">

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: 'User Access Control',
                  desc: 'Manage roles and granular module access for admin and project manager accounts.',
                  href: '/admin/users',
                  icon: Users,
                  color: 'indigo',
                  label: 'Manage Users',
                },
                {
                  title: 'Add-on Catalog',
                  desc: 'Manage the list, pricing, and descriptions of all available AI and engagement add-ons.',
                  href: '/admin/addons/catalog',
                  icon: Zap,
                  color: 'amber',
                  label: 'Manage Catalog',
                },
                {
                  title: 'Email Inbox',
                  desc: 'View all incoming client messages and sent email logs in one place.',
                  href: '/admin/inbox',
                  icon: Mail,
                  color: 'blue',
                  label: 'View Inbox',
                },
              ].map(card => (
                <div key={card.href} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
                  <div className={`w-10 h-10 rounded-xl bg-${card.color}-50 flex items-center justify-center mb-4`}>
                    <card.icon className={`w-5 h-5 text-${card.color}-600`} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{card.title}</h3>
                  <p className="text-xs text-slate-500 flex-1 mb-4">{card.desc}</p>
                  <Link
                    to={card.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {card.label}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;
