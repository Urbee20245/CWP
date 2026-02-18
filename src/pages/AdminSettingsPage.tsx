"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Settings, MessageSquare, Shield, ExternalLink, CheckCircle2, AlertTriangle, Mail, DollarSign, Zap, Users, Bot, Calendar, Loader2, ShieldCheck, Save, CheckCircle } from 'lucide-react';
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

const AdminSettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const [adminClientId, setAdminClientId] = useState<string | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [calStatus, setCalStatus] = useState<CalStatus | null>(null);
  const [isLoadingCalStatus, setIsLoadingCalStatus] = useState(true);

  // reCAPTCHA settings
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
      // First try to find existing client record
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .maybeSingle();

      if (clientData) {
        setAdminClientId(clientData.id);
        fetchCalStatus(clientData.id);
      } else {
        // Auto-create a client record for the admin
        console.log('[AdminSettingsPage] No client record found, creating one for admin...');
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
          console.log('[AdminSettingsPage] Admin client created:', newClient.id);
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
              href={SUPABASE_SECRETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Go to Supabase Secrets
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Cal.com OAuth (Cal AI) - Connection + Setup */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" /> Cal.com Integration
              </h2>
              {/* Connection Status Badge */}
              {isLoadingCalStatus ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Checking...</span>
                </div>
              ) : calStatus?.connection_status === 'connected' && (calStatus?.auth_method === 'api_key' || calStatus?.refresh_token_present) ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">Connected{calStatus?.auth_method === 'api_key' ? ' (API Key)' : ''}</span>
                </div>
              ) : calStatus?.connection_status === 'needs_reauth' || (calStatus?.connection_status === 'connected' && calStatus?.auth_method !== 'api_key' && !calStatus?.refresh_token_present) ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Needs Reconnection</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Not Connected</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Connect Cal.com */}
              <div>
                <h3 className="font-bold text-slate-800 mb-3">Connect Your Cal.com Account</h3>
                {isLoadingClient ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                ) : adminClientId ? (
                  <ClientCalComIntegration
                    clientId={adminClientId}
                    isAdminView={true}
                    onStatusChange={() => fetchCalStatus(adminClientId)}
                  />
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-amber-800 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      No client record found for your admin account. Please create one first.
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Setup Instructions */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 mb-3">Setup Instructions</h3>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Required Supabase Secrets
                  </h4>
                  <ul className="space-y-1 text-sm text-emerald-800">
                    <li><code className="font-mono text-xs bg-emerald-200 px-1 rounded">CAL_CLIENT_ID</code></li>
                    <li><code className="font-mono text-xs bg-emerald-200 px-1 rounded">CAL_CLIENT_SECRET</code></li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-700 mb-2">OAuth Redirect URI (set in Cal.com)</p>
                  <code className="block font-mono text-[11px] text-slate-800 break-all">{CAL_OAUTH_REDIRECT_URI}</code>
                </div>

                <a
                  href={SUPABASE_SECRETS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Go to Supabase Secrets
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
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

          {/* Retell AI Configuration */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Bot className="w-5 h-5 text-indigo-600" /> Retell AI Configuration
            </h2>

            <p className="text-slate-600 mb-6">
              Retell AI powers the AI call handling feature. Each client gets their own custom Retell agent for personalized call handling.
            </p>

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-6">
              <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Required Supabase Secret
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <code className="font-mono text-xs bg-indigo-200 px-2 py-1 rounded">RETELL_API_KEY</code>
                <span className="text-slate-600">— Your Retell AI API key from the <a href="https://dashboard.retellai.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Retell Dashboard</a></span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6">
              <h3 className="font-bold text-slate-700 mb-3">How It Works</h3>
              <ol className="space-y-2 text-sm text-slate-600 list-decimal ml-4">
                <li>Client enters their Twilio credentials (Account SID, Auth Token, Phone Number) in their Settings page</li>
                <li>You see the "Twilio" badge on the AI Call Management page when credentials are ready</li>
                <li>Create a custom Retell Agent for this client in <a href="https://dashboard.retellai.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Retell Dashboard</a></li>
                <li>Enter the client's Retell Agent ID on the AI Call Management page</li>
                <li>Click "Enable AI Call Handling" to import the phone number into Retell AI with their custom agent</li>
              </ol>
            </div>

            <div className="flex gap-4">
              <a
                href={SUPABASE_SECRETS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Go to Supabase Secrets
                <ExternalLink className="w-4 h-4" />
              </a>
              <Link
                to="/admin/voice"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                Go to AI Call Management
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Encryption Key */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Shield className="w-5 h-5 text-red-600" /> Encryption Key
            </h2>
            <p className="text-slate-600 mb-4 text-sm">
              Client Twilio credentials are encrypted at rest. Ensure this secret is set:
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <code className="font-mono text-xs text-red-700">SMTP_ENCRYPTION_KEY</code>
              <p className="text-xs text-red-600 mt-2">Used to encrypt/decrypt sensitive client data. Must be 32+ characters.</p>
            </div>
          </div>

          {/* Google reCAPTCHA */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <ShieldCheck className="w-5 h-5 text-blue-600" /> Google reCAPTCHA
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
              One site key protects all client contact forms across every site you host. Set it once here and it applies automatically.
            </p>

            <div className="space-y-5">
              {/* Site Key input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  reCAPTCHA v3 Site Key <span className="text-slate-400 font-normal">(public — saved to database)</span>
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={recaptchaSiteKey}
                    onChange={e => setRecaptchaSiteKey(e.target.value)}
                    placeholder="6Le..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveRecaptcha}
                    disabled={recaptchaSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {recaptchaSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : recaptchaSaved ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {recaptchaSaved ? 'Saved!' : 'Save'}
                  </button>
                </div>
                {recaptchaError && (
                  <p className="mt-2 text-sm text-red-600">{recaptchaError}</p>
                )}
              </div>

              {/* Secret Key instructions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Secret Key (server-side)
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Add your reCAPTCHA v3 secret key as a Supabase Edge Function secret. It is used by the <code className="font-mono text-xs bg-blue-200 px-1 rounded">public-contact-form</code> function to verify form submissions server-side.
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <code className="font-mono text-xs bg-blue-200 px-2 py-1 rounded">RECAPTCHA_SECRET_KEY</code>
                  <span className="text-xs text-blue-600">— your reCAPTCHA v3 secret key</span>
                </div>
                <a
                  href={SUPABASE_SECRETS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Go to Supabase Secrets
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <p className="text-xs text-slate-400">
                Get your keys at <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">google.com/recaptcha/admin</a>. Select <strong>reCAPTCHA v3</strong> and add all your client domains.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;