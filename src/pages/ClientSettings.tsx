"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Settings, ShieldCheck, ArrowRight, Loader2, MessageSquare, Phone, Globe, Zap, Info, AlertTriangle, Clock, CheckCircle2, Calendar } from 'lucide-react';
import ClientTwilioIntegration from '../components/ClientTwilioIntegration';
import ClientCalendarIntegration from '../components/ClientCalendarIntegration'; // NEW IMPORT
import { Link } from 'react-router-dom';

interface VoiceIntegration {
    a2p_status: string;
    voice_status: string;
}

const ClientSettings: React.FC = () => {
  const { profile, isLoading } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [voiceIntegration, setVoiceIntegration] = useState<VoiceIntegration | null>(null);
  const [isClientLoading, setIsClientLoading] = useState(true);

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
        case 'approved': return { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 };
        case 'pending_approval':
        case 'submitted': return { label: 'Pending Approval', color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock };
        case 'rejected': return { label: 'Needs Attention', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
        default: return { label: 'Not Started', color: 'text-amber-600', bg: 'bg-amber-50', icon: Info };
    }
  };
  
  const a2pDisplay = getA2PStatusDisplay();

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-600" /> Integrations & Settings
        </h1>
        <p className="text-slate-600 mb-10 max-w-2xl">
            Manage your third-party integrations and AI service configurations.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* OPTION 1: Done-For-You (The Primary Path) */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-600 overflow-hidden relative group">
            {/* Recommendation Badge */}
            <div className="bg-indigo-600 text-white text-[10px] font-bold py-1 px-4 uppercase tracking-widest absolute top-0 right-0 rounded-bl-xl shadow-md">
                Recommended
            </div>
            
            <div className="p-8">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Zap className="w-7 h-7 text-indigo-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Option 1: Done-For-You Setup</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Let our team handle the technical heavy lifting. We will provision your business number, 
                    configure the AI logic, and ensure network compliance for you.
                </p>

                <div className={`space-y-4 mb-8 p-4 rounded-xl border border-current ${a2pDisplay.bg}`}>
                    <div className="flex items-start gap-3">
                        <a2pDisplay.icon className={`w-5 h-5 ${a2pDisplay.color} flex-shrink-0 mt-0.5`} />
                        <div>
                            <p className="text-sm font-bold text-slate-900">Messaging Verification: {a2pDisplay.label}</p>
                            {a2pStatus === 'approved' && voiceStatus === 'active' && (
                                <p className="text-xs text-emerald-700 mt-1 font-semibold">
                                    AI Call Handling is fully active and operational.
                                </p>
                            )}
                            {a2pStatus === 'approved' && voiceStatus !== 'active' && (
                                <p className="text-xs text-emerald-700 mt-1 font-semibold">
                                    Verification complete. AI Call Handling will activate shortly.
                                </p>
                            )}
                            {a2pStatus !== 'approved' && (
                                <p className="text-xs text-slate-500 mt-1">
                                    You must submit your business details to start the verification process.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <Link 
                    to="/client/messaging-compliance"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                    {a2pStatus === 'approved' ? 'View Verification Status' : 'Start Messaging Verification'}
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
            
            <div className="px-8 py-4 bg-indigo-50/50 border-t border-indigo-100">
                <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-3 h-3" /> Best for 95% of businesses
                </p>
            </div>
          </div>

          {/* OPTION 2: Integrations Panel */}
          <div className="space-y-6">
              {/* Google Calendar Integration Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden group p-8">
                {clientId && <ClientCalendarIntegration clientId={clientId} />}
              </div>

              {/* Twilio Integration Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden group p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-slate-600" /> Twilio Integration
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Connect your Twilio account to enable AI-powered voice calls. One-click setup via Twilio Connect or enter credentials manually.
                </p>
                {clientId && <ClientTwilioIntegration clientId={clientId} />}
              </div>
              
              <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
                  <p className="text-sm text-slate-500 font-medium">Additional integration options (Email, CRM) coming soon.</p>
              </div>
          </div>

        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientSettings;