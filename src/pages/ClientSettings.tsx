"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import {
  Loader2, Phone, Calendar, Mail, Zap, Info, AlertTriangle, Clock,
  CheckCircle2, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import ClientTwilioIntegration from '../components/ClientTwilioIntegration';
import ClientCalendarIntegration from '../components/ClientCalendarIntegration';
import ClientCalComIntegration from '../components/ClientCalComIntegration';
import ClientCalendarProviderSelector from '../components/ClientCalendarProviderSelector';
import { Link } from 'react-router-dom';

interface VoiceIntegration {
  a2p_status: string;
  voice_status: string;
}

const ClientIntegrationsPage: React.FC = () => {
  const { profile, isLoading } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [voiceIntegration, setVoiceIntegration] = useState<VoiceIntegration | null>(null);
  const [isClientLoading, setIsClientLoading] = useState(true);

  // Collapsible section state
  const [openSection, setOpenSection] = useState<string | null>('phone');

  const fetchClientData = useCallback(async () => {
    if (!profile) return;
    setIsClientLoading(true);
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, client_voice_integrations (a2p_status, voice_status)')
      .eq('owner_profile_id', profile.id)
      .maybeSingle();

    if (clientData) {
      setClientId(clientData.id);
      const integration = (clientData.client_voice_integrations as any)?.[0];
      setVoiceIntegration(integration || { a2p_status: 'not_started', voice_status: 'inactive' });
    }
    setIsClientLoading(false);
  }, [profile]);

  useEffect(() => {
    if (profile) fetchClientData();
  }, [profile, fetchClientData]);

  const a2pStatus = voiceIntegration?.a2p_status || 'not_started';
  const voiceStatus = voiceIntegration?.voice_status || 'inactive';

  const getA2PStatusDisplay = () => {
    switch (a2pStatus) {
      case 'approved':
        return { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 };
      case 'pending_approval':
      case 'submitted':
        return { label: 'Pending Approval', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock };
      case 'rejected':
        return { label: 'Needs Attention', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle };
      default:
        return { label: 'Not Started', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Info };
    }
  };

  const a2pDisplay = getA2PStatusDisplay();

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

  if (isLoading || isClientLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }

  const SectionHeader = ({
    id, icon: Icon, title, subtitle, badge,
  }: {
    id: string; icon: React.ElementType; title: string; subtitle: string; badge?: React.ReactNode;
  }) => {
    const isOpen = openSection === id;
    return (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center gap-4 text-left px-6 py-5 hover:bg-slate-50/70 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-900">{title}</span>
            {badge}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {isOpen
          ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
    );
  };

  const StatusBadge = () => (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${a2pDisplay.bg} ${a2pDisplay.border} ${a2pDisplay.color}`}>
      <a2pDisplay.icon className="w-3 h-3" />
      {a2pDisplay.label}
    </span>
  );

  return (
    <ClientLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 text-sm mt-1">Connect your phone, calendar, and email tools to power your automated workflows.</p>
        </div>

        {/* ─── PHONE INTEGRATION ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
          <SectionHeader
            id="phone"
            icon={Phone}
            title="Phone Integration"
            subtitle="Set up your AI-powered business number and SMS automation"
            badge={<StatusBadge />}
          />

          {openSection === 'phone' && (
            <div className="border-t border-slate-100 px-6 py-6 space-y-6">

              {/* A2P Notice */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">A2P Approval Required for SMS</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    To send or receive SMS messages legally in the US, your number must be registered through the A2P (10DLC) program.
                    Voice-only calls do not require this.{' '}
                    <Link to="/client/help" className="underline font-semibold">Learn more in Help & Guides →</Link>
                  </p>
                </div>
              </div>

              {/* Two Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Option 1 */}
                <div className="relative rounded-xl border-2 border-indigo-600 bg-indigo-50/50 p-5">
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Recommended
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-2 mb-1">Option 1 — Done-For-You</h3>
                  <p className="text-xs text-slate-600 mb-4">
                    Our team provisions your business number, handles A2P registration, and configures the AI logic for you.
                  </p>

                  <div className={`p-3 rounded-lg border ${a2pDisplay.bg} ${a2pDisplay.border} mb-4`}>
                    <div className="flex items-center gap-2">
                      <a2pDisplay.icon className={`w-4 h-4 ${a2pDisplay.color} flex-shrink-0`} />
                      <p className="text-xs font-bold text-slate-900">
                        Messaging Verification: {a2pDisplay.label}
                      </p>
                    </div>
                    {a2pStatus === 'approved' && voiceStatus === 'active' && (
                      <p className="text-xs text-emerald-700 mt-1 font-semibold ml-6">AI Call Handling is fully active.</p>
                    )}
                    {a2pStatus !== 'approved' && (
                      <p className="text-xs text-slate-500 mt-1 ml-6">Submit your business details to begin verification.</p>
                    )}
                  </div>

                  <Link
                    to="/client/messaging-compliance"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    {a2pStatus === 'approved' ? 'View Verification Status' : 'Start Messaging Verification'}
                  </Link>
                </div>

                {/* Option 2 */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Option 2 — I Already Have a Number</h3>
                  <p className="text-xs text-slate-600 mb-3">
                    Already have a Twilio or Telnyx number? Enter your credentials below to connect it directly.
                  </p>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-slate-700">Supported Providers:</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-medium">Twilio</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-medium">Telnyx</span>
                    </div>
                    <p className="text-amber-700 font-medium flex items-start gap-1 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      You must still complete A2P registration through your provider to send SMS.
                    </p>
                  </div>

                  {clientId && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-700">Connect Twilio Credentials</p>
                      <ClientTwilioIntegration clientId={clientId} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── CALENDAR BOOKING ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
          <SectionHeader
            id="calendar"
            icon={Calendar}
            title="Calendar Booking"
            subtitle="Choose how clients and your AI agent book appointments"
          />

          {openSection === 'calendar' && (
            <div className="border-t border-slate-100 px-6 py-6 space-y-6">

              {/* Preferred notice */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">We Recommend Cal.com</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Cal.com is free, integrates seamlessly with your AI agent, and works with Retell AI for automated
                    voice booking. Google Calendar is a secondary option.{' '}
                    <Link to="/client/help" className="underline font-semibold">Setup guide in Help →</Link>
                  </p>
                </div>
              </div>

              {/* Provider selector (controls which provider is used) */}
              {clientId && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-bold text-slate-700 mb-3">Active Booking Provider</p>
                  <ClientCalendarProviderSelector clientId={clientId} />
                </div>
              )}

              {/* Cal.com */}
              <div className="rounded-xl border-2 border-emerald-300 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 border-b border-emerald-200">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-emerald-800">Cal.com</h3>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-full uppercase tracking-wider">
                    Preferred · Free
                  </span>
                </div>
                <div className="p-5">
                  {clientId && <ClientCalComIntegration clientId={clientId} />}
                  <p className="text-xs text-slate-500 mt-3">
                    Don't have a Cal.com account?{' '}
                    <a href="https://app.cal.com/signup" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-semibold">
                      Sign up free at cal.com
                    </a>{' '}
                    — then see the setup guide in{' '}
                    <Link to="/client/help" className="text-emerald-600 underline font-semibold">Help & Guides</Link>.
                  </p>
                </div>
              </div>

              {/* Google Calendar */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">Google Calendar</h3>
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full uppercase tracking-wider">
                    Secondary Option
                  </span>
                </div>
                <div className="p-5">
                  {clientId && <ClientCalendarIntegration clientId={clientId} />}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── EMAIL ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
          <SectionHeader
            id="email"
            icon={Mail}
            title="Corporate Email"
            subtitle="Professional email addresses for your domain (add-on)"
            badge={
              <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full border border-violet-200 uppercase tracking-wider">
                Add-on
              </span>
            }
          />

          {openSection === 'email' && (
            <div className="border-t border-slate-100 px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">What's included</h3>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {[
                      'Custom domain email (e.g., hello@yourbusiness.com)',
                      'Google Workspace or Microsoft 365 setup',
                      'DNS and MX record configuration',
                      'Up to 5 business inboxes',
                      'Spam filtering and forwarding rules',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 bg-violet-50 border border-violet-200 rounded-xl flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-violet-800 uppercase tracking-wide mb-1">Add-on Service</p>
                    <p className="text-sm text-violet-700 mt-1">
                      Corporate email setup is managed by your project team and billed as a one-time add-on.
                    </p>
                  </div>
                  <Link
                    to="/client/addons"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Request This Add-on
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </ClientLayout>
  );
};

export default ClientIntegrationsPage;
