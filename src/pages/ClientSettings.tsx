"use client";

import React, { useState, useEffect } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Settings, ShieldCheck, ArrowRight, Loader2, MessageSquare, Phone, Globe, Zap, Info, AlertTriangle } from 'lucide-react';
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-600" /> AI Voice & Messaging Settings
        </h1>
        <p className="text-slate-600 mb-10 max-w-2xl">
            Choose how you would like to set up your AI call handling and text messaging services. 
            Most customers prefer our automated setup.
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

                <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-slate-900">Messaging Verification Required</p>
                            <p className="text-xs text-slate-500 mt-1">
                                To activate this service, we must verify your business identity with mobile networks (A2P compliance).
                            </p>
                        </div>
                    </div>
                    
                    <ul className="space-y-2 text-xs text-slate-500 ml-1">
                        <li className="flex items-center gap-2">• We provide the phone number</li>
                        <li className="flex items-center gap-2">• We handle the A2P registration</li>
                        <li className="flex items-center gap-2">• All-in-one monthly billing</li>
                    </ul>
                </div>

                <Link 
                    to="/client/messaging-compliance"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                    Start Messaging Verification
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
            
            <div className="px-8 py-4 bg-indigo-50/50 border-t border-indigo-100">
                <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-3 h-3" /> Best for 95% of businesses
                </p>
            </div>
          </div>

          {/* OPTION 2: Bring Your Own Twilio (The Advanced Path) */}
          <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden group">
                <div className="p-8">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Globe className="w-6 h-6 text-slate-600" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-slate-900 mb-3">Option 2: Bring Your Own Twilio</h2>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Already have a Twilio account? You can connect your existing credentials below. 
                        You will be responsible for your own Twilio usage costs and A2P registration.
                    </p>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-8">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 leading-normal">
                                <strong>Technical Warning:</strong> This path requires manual A2P (10DLC) registration within your Twilio Console to prevent message blocking.
                            </p>
                        </div>
                    </div>
                    
                    {/* Render the Twilio Integration Component here */}
                    {clientId && (
                        <div className="border-t border-slate-100 pt-6">
                            <ClientTwilioIntegration clientId={clientId} />
                        </div>
                    )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
                  <p className="text-sm text-slate-500 font-medium">Additional integration options (Email, CRM, Calendars) coming soon.</p>
              </div>
          </div>

        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientSettings;