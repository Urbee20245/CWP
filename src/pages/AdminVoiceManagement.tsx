"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import { supabase } from '../integrations/supabase/client';
import {
  Bot, Phone, Zap, Search, Loader2, CheckCircle2, AlertTriangle,
  Plus, Power, PowerOff, RefreshCw, Info
} from 'lucide-react';

interface Client {
  id: string;
  business_name: string;
  phone: string;
  voice_status: string;
  number_source: string;
  a2p_status: string;
  twilio_configured: boolean;
  twilio_phone: string | null;
  retell_agent_id: string;
  phone_number: string | null;
  connection_method: string;
  manually_provisioned?: boolean;
}

const AdminVoiceManagement: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Manual override state
  const [manualRetellId, setManualRetellId] = useState('');

  const showFeedback = (type: 'success' | 'error' | 'info', text: string, durationMs = 8000) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), durationMs);
  };

  const mapClientData = (rawClients: any[]) => {
    return rawClients.map((c: any) => {
      const twilioIntegration = c.client_integrations?.find?.((i: any) => i.provider === 'twilio');
      const hasTwilioCredentials = !!(
        twilioIntegration?.account_sid_encrypted &&
        twilioIntegration?.auth_token_encrypted &&
        twilioIntegration?.phone_number
      );
      const voiceData = Array.isArray(c.client_voice_integrations)
        ? c.client_voice_integrations[0]
        : c.client_voice_integrations;

      return {
        id: c.id,
        business_name: c.business_name || 'Unknown',
        phone: c.phone || '',
        voice_status: voiceData?.voice_status || 'inactive',
        number_source: voiceData?.number_source || (hasTwilioCredentials ? 'client' : 'platform'),
        a2p_status: voiceData?.a2p_status || 'none',
        retell_agent_id: voiceData?.retell_agent_id || '',
        twilio_configured: hasTwilioCredentials,
        twilio_phone: twilioIntegration?.phone_number || null,
        phone_number: voiceData?.phone_number || twilioIntegration?.phone_number || null,
        connection_method: twilioIntegration?.connection_method || 'none',
        manually_provisioned: !!voiceData?.manually_provisioned,
      };
    });
  };

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          business_name,
          phone,
          client_voice_integrations (
            voice_status,
            number_source,
            a2p_status,
            retell_agent_id,
            phone_number,
            retell_phone_id,
            manually_provisioned
          ),
          client_integrations (
            provider,
            phone_number,
            account_sid_encrypted,
            auth_token_encrypted,
            connection_method
          )
        `)
        .order('business_name', { ascending: true });

      if (error) throw error;

      setClients(mapClientData(data || []));
    } catch (directErr: any) {
      console.warn('[AdminVoiceManagement] Direct clients query failed:', directErr?.message);
      try {
        const clientsData = await AdminService.getVoiceClients();
        setClients(mapClientData(clientsData || []));
      } catch (edgeFnErr: any) {
        console.warn('[AdminVoiceManagement] Edge function failed:', edgeFnErr.message);
        if (clients.length === 0) {
          showFeedback('error', 'Unable to load clients right now. Please try again shortly.');
        } else {
          showFeedback('info', 'Live voice data is temporarily unavailable. Showing last loaded values.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [clients.length]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    // Reset manualRetellId when client changes
    setManualRetellId('');
  }, [selectedClientId]);

  const filteredClients = clients.filter(c =>
    c.business_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const isVoiceActive = selectedClient?.voice_status === 'active' || selectedClient?.manually_provisioned;
  const hasTwilio = selectedClient?.twilio_configured === true;
  const hasAgent = !!selectedClient?.retell_agent_id?.trim?.();
  const canEnable = hasTwilio && hasAgent && !isVoiceActive;

  const getVoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const steps = selectedClient ? (() => {
    const s: { label: string; done: boolean; description: string }[] = [];
    s.push({
      label: 'Twilio Connected',
      done: hasTwilio,
      description: hasTwilio
        ? `Phone: ${selectedClient?.twilio_phone || '—'}`
        : 'Client must connect Twilio and select a phone in Client Settings',
    });
    s.push({
      label: 'Agent Configured',
      done: hasAgent,
      description: hasAgent
        ? `Agent ID saved in Agent Settings`
        : 'Set Retell Agent on the AI Agent Settings page',
    });
    s.push({
      label: 'AI Calls Active',
      done: isVoiceActive,
      description: isVoiceActive
        ? 'AI Call Handling is live'
        : (selectedClient?.voice_status === 'pending')
          ? 'Pending activation (will auto-activate after requirements are met)'
          : 'Click Enable when ready',
    });
    return s;
  })() : [];

  const handleEnableVoice = async () => {
    if (!selectedClientId || !canEnable) return;
    setIsProvisioning(true);
    setFeedbackMessage(null);

    try {
      const result = await AdminService.provisionVoiceNumber(
        selectedClientId,
        'client'
      );

      if (result?.pending) {
        showFeedback('success', result.message || 'Enabled (pending).');
      } else {
        showFeedback('success', 'AI Call Handling successfully enabled!');
      }
      await fetchClients();
    } catch (e: any) {
      showFeedback('error', e.message || 'Provisioning failed.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDisableVoice = async () => {
    if (!selectedClientId || !isVoiceActive) return;
    if (!confirm('Disable AI Call Handling for this client? This removes the number from Retell.')) return;

    setIsDisabling(true);
    setFeedbackMessage(null);

    try {
      await AdminService.disableVoice(selectedClientId);
      showFeedback('success', 'AI Call Handling disabled.');
      await fetchClients();
    } catch (e: any) {
      showFeedback('error', `Disable failed: ${e.message}`);
    } finally {
      setIsDisabling(false);
    }
  };

  const handleManualProvision = async () => {
    if (!selectedClientId) return;
    setFeedbackMessage(null);

    try {
      const payload: any = {
        client_id: selectedClientId,
        manually_provisioned: true,
        voice_status: 'active',
        number_source: 'client',
      };
      if (manualRetellId.trim()) {
        payload.retell_phone_id = manualRetellId.trim();
      }

      const { error } = await supabase
        .from('client_voice_integrations')
        .upsert(payload, { onConflict: 'client_id' });

      if (error) throw error;

      showFeedback('success', 'Marked as manually provisioned.');
      await fetchClients();
    } catch (e: any) {
      showFeedback('error', `Failed to save manual override: ${e.message}`);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <Bot className="w-8 h-8 text-indigo-600" /> AI Call Management
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Client List */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-[650px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Select Client</h2>
                <button onClick={() => fetchClients()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
                  <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search businesses..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {isLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" /></div>
                ) : filteredClients.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No clients found.</p>
                ) : (
                  filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${selectedClientId === c.id ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-100 hover:bg-slate-50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{c.business_name}</p>
                          {c.twilio_configured && (
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase flex-shrink-0 ${c.connection_method === 'twilio_connect' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                              {c.connection_method === 'twilio_connect' ? 'Connected' : 'Twilio'}
                            </span>
                          )}
                          {c.manually_provisioned && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase flex-shrink-0 bg-amber-100 text-amber-700">
                              Manual
                            </span>
                          )}
                        </div>
                        {c.voice_status === 'active' && <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500 flex-shrink-0" />}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                          client number
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${c.voice_status === 'active' ? 'text-emerald-600' : c.voice_status === 'failed' ? 'text-red-500' : c.voice_status === 'pending' ? 'text-amber-600' : 'text-slate-400'}`}>
                          {c.voice_status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Management Panel */}
          <div className="lg:col-span-2 space-y-6">
            {selectedClient ? (
              <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 animate-fade-in">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedClient.business_name}</h2>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {selectedClient.phone || 'No phone on record'}
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest ${getVoiceStatusBadge(selectedClient.voice_status)}`}>
                    {selectedClient.voice_status}
                  </div>
                </div>

                {/* Client-Owned Twilio indicator */}
                <div className="p-4 mb-6 rounded-xl border flex items-center gap-3 bg-purple-50 border-purple-200">
                  <>
                    <Plus className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-bold text-sm text-purple-700">
                        Client-Owned Twilio Number {selectedClient.connection_method === 'twilio_connect' ? '(Connected via OAuth)' : ''}
                      </p>
                      <p className="text-xs mt-0.5 text-purple-600">
                        {selectedClient.connection_method === 'twilio_connect'
                          ? `Twilio Connect authorized. Phone: `
                          : `Client entered credentials. Phone: `}
                        <span className="font-mono font-semibold">{selectedClient.twilio_phone}</span>
                      </p>
                    </div>
                  </>
                </div>

                {/* Progress Steps */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Setup Progress</h3>
                  <div className="space-y-3">
                    {steps.map((step, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${step.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                          {step.done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${step.done ? 'text-emerald-700' : 'text-slate-700'}`}>{step.label}</p>
                          <p className={`text-xs mt-0.5 ${step.done ? 'text-emerald-600' : 'text-slate-500'}`}>{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agent reminder */}
                {!hasAgent && (
                  <div className="p-4 rounded-xl border bg-indigo-50 border-indigo-200 flex items-start gap-3 mb-4">
                    <Info className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-indigo-800">Retell Agent not set</p>
                      <p className="text-indigo-700 mt-1">Go to AI Agent Settings to add a Retell Agent ID for this client. Once set, return here to enable AI calls.</p>
                    </div>
                  </div>
                )}

                {/* Feedback Message */}
                {feedbackMessage && (
                  <div className={`p-3 mb-4 rounded-lg text-sm flex items-center gap-2 ${
                    feedbackMessage.type === 'success' ? 'bg-emerald-100 border border-emerald-300 text-emerald-800' :
                    feedbackMessage.type === 'error' ? 'bg-red-100 border border-red-300 text-red-800' :
                    'bg-blue-100 border border-blue-300 text-blue-800'
                  }`}>
                    {feedbackMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                    <span>{feedbackMessage.text}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {!isVoiceActive ? (
                    <button
                      onClick={handleEnableVoice}
                      disabled={isProvisioning || !canEnable}
                      className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                      {isProvisioning ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Enabling AI Calls...
                        </>
                      ) : (
                        <>
                          <Power className="w-6 h-6" />
                          Enable AI Call Handling
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3">
                        <CheckCircle2 className="w-6 h-6" />
                        AI Call Handling Active
                      </div>
                      <button
                        onClick={handleDisableVoice}
                        disabled={isDisabling}
                        className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        {isDisabling ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Disabling...
                          </>
                        ) : (
                          <>
                            <PowerOff className="w-4 h-4" />
                            Disable AI Call Handling
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {!isVoiceActive && !canEnable && (
                    <p className="text-xs text-slate-500 text-center">
                      Ensure Twilio is connected and the Retell Agent is set on the AI Agent Settings page.
                    </p>
                  )}
                </div>

                {/* Manual Provisioning Override */}
                <div className="mt-6 p-4 border border-amber-200 bg-amber-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">Manual Provisioning Override</p>
                      <p className="text-xs text-amber-700 mt-1">
                        If you already imported this client’s number into Retell manually, mark it here to skip automatic provisioning. You can optionally store the Retell Phone ID for reference.
                      </p>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <input
                          type="text"
                          placeholder="Retell Phone ID (optional)"
                          value={manualRetellId}
                          onChange={(e) => setManualRetellId(e.target.value)}
                          className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-white font-mono"
                        />
                        <button
                          onClick={handleManualProvision}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
                        >
                          Mark as Provisioned Manually
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-[0.2em]">
                  Custom Websites Plus — AI Voice Automation
                </p>
              </div>
            ) : (
              <div className="bg-white p-20 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center text-center">
                <Bot className="w-16 h-16 text-slate-200 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Manage</h3>
                <p className="text-slate-500 max-w-sm">Select a client from the list to import and enable their Twilio number on Retell.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminVoiceManagement;