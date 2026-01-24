"use client";

import React, { useState, useEffect } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Settings, ShieldCheck, ArrowRight, Loader2, MessageSquare } from 'lucide-react';
import ClientTwilioIntegration from '../components/ClientTwilioIntegration';
import { Link } from 'react-router-dom';

const ClientSettings: React.FC = () => {
  const { profile, isLoading } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [isClientLoading, setIsClientLoading] = useState(true);

  useEffect(() => {
    const fetchClientId = async () => {
      if (!profile) return;
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .single();
      
      if (data) setClientId(data.id);
      setIsClientLoading(false);
    };

    if (profile) fetchClientId();
  }, [profile]);

  if (isLoading || isClientLoading) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-600" /> Settings & Integrations
        </h1>

        <div className="space-y-8">
          
          {/* 1. Phone & Messaging Integration (Twilio) */}
          {clientId && <ClientTwilioIntegration clientId={clientId} />}

          {/* 2. Messaging Compliance Hub */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">Messaging Verification</h2>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">
                Mobile networks require all businesses to verify their identity to prevent spam and ensure high delivery rates for text messages. 
                Complete your business profile to activate automated appointment reminders.
            </p>

            <Link 
                to="/client/messaging-compliance"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all group"
            >
                Open Verification Form
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Additional Settings Placeholder */}
          <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
              <p className="text-sm text-slate-500 font-medium">More integration options (Email, CRM, Calendars) coming soon.</p>
          </div>

        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientSettings;