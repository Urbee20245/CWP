"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import {
  ShieldCheck,
  Loader2,
  Building2,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Globe,
  User,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

interface A2PRegistrationData {
  legal_name: string;
  business_type: string;
  ein: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  website: string;
  use_case: string;
  sample_message: string;
  contact_name: string;
  contact_email: string;
}

interface ClientA2PRecord {
  id: string;
  client_id: string;
  a2p_status: string;
  a2p_registration_data: A2PRegistrationData | null;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    business_name: string;
    billing_email: string;
  };
}

// A2P Use Case Types based on Twilio/TCR standards
const USE_CASE_TYPES = [
  { value: '2FA', label: '2FA (Two-Factor Authentication)', description: 'OTP and account verification' },
  { value: 'ACCOUNT_NOTIFICATION', label: 'Account Notifications', description: 'Status updates about accounts' },
  { value: 'CUSTOMER_CARE', label: 'Customer Care', description: 'Support and account management' },
  { value: 'DELIVERY_NOTIFICATION', label: 'Delivery Notifications', description: 'Shipping and delivery updates' },
  { value: 'MARKETING', label: 'Marketing', description: 'Promotional messages (requires explicit consent)' },
  { value: 'MIXED', label: 'Mixed/Low Volume', description: 'Multiple use cases combined' },
  { value: 'POLLING_VOTING', label: 'Polling and Voting', description: 'Surveys and feedback collection' },
  { value: 'FRAUD_ALERT', label: 'Fraud Alert', description: 'Security and fraud notifications' },
  { value: 'HIGHER_EDUCATION', label: 'Higher Education', description: 'Educational institution communications' },
  { value: 'PUBLIC_SERVICE', label: 'Public Service Announcement', description: 'PSAs and awareness campaigns' },
];

const AdminA2PAutomation: React.FC = () => {
  const [records, setRecords] = useState<ClientA2PRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatedTemplates, setGeneratedTemplates] = useState<Record<string, any>>({});

  const fetchPendingRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_voice_integrations')
        .select(`
          id, client_id, a2p_status, a2p_registration_data, created_at, updated_at,
          clients (id, business_name, billing_email)
        `)
        .in('a2p_status', ['pending_approval', 'not_started'])
        .not('a2p_registration_data', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecords((data as ClientA2PRecord[]) || []);
    } catch (e: any) {
      console.error('Error fetching A2P records:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRegistrations();
  }, [fetchPendingRegistrations]);

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  // Generate AI-assisted A2P templates based on client data
  const generateA2PTemplates = (data: A2PRegistrationData) => {
    const businessName = data.legal_name || 'Your Business';
    const useCase = data.use_case || '';
    const website = data.website || '';

    // Determine best use case type based on their description
    let suggestedUseCase = 'MIXED';
    const useCaseLower = useCase.toLowerCase();
    if (useCaseLower.includes('appointment') || useCaseLower.includes('reminder') || useCaseLower.includes('confirmation')) {
      suggestedUseCase = 'ACCOUNT_NOTIFICATION';
    } else if (useCaseLower.includes('support') || useCaseLower.includes('customer') || useCaseLower.includes('question')) {
      suggestedUseCase = 'CUSTOMER_CARE';
    } else if (useCaseLower.includes('marketing') || useCaseLower.includes('promotion') || useCaseLower.includes('sale')) {
      suggestedUseCase = 'MARKETING';
    } else if (useCaseLower.includes('delivery') || useCaseLower.includes('shipping') || useCaseLower.includes('order')) {
      suggestedUseCase = 'DELIVERY_NOTIFICATION';
    } else if (useCaseLower.includes('verification') || useCaseLower.includes('otp') || useCaseLower.includes('code')) {
      suggestedUseCase = '2FA';
    } else if (useCaseLower.includes('security') || useCaseLower.includes('fraud') || useCaseLower.includes('alert')) {
      suggestedUseCase = 'FRAUD_ALERT';
    }

    // Generate campaign description following best practices
    const campaignDescription = `${businessName} uses SMS messaging to communicate with customers who have opted-in to receive text messages. Messages are sent for the purpose of ${useCase.toLowerCase().replace(/\.$/, '')}. Recipients are existing customers or leads who have provided their phone number and explicit consent to receive SMS communications from ${businessName}. Messages are sent from a verified business phone number registered with ${businessName}.`;

    // Generate sample messages (must include business name and opt-out)
    const sampleMessages = [
      `${businessName}: Hi [Name], this is a reminder about your upcoming appointment on [Date] at [Time]. Reply STOP to opt out.`,
      `${businessName}: Your request has been received and is being processed. We'll update you shortly. Reply STOP to unsubscribe.`,
      `${businessName}: Thank you for contacting us! A team member will respond within 24 hours. Msg & data rates may apply. Reply STOP to opt out.`,
    ];

    // Generate opt-in confirmation message (required, max 160 chars)
    const optInConfirmation = `Welcome to ${businessName.substring(0, 30)}! You've opted in to receive SMS updates. Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel.`;

    // Generate message flow / call-to-action description
    const messageFlow = `Customers opt-in to receive SMS messages from ${businessName} through the following methods:

1. **Website Form**: When customers submit a contact form or booking request on ${website}, they check a clearly labeled consent box stating: "I agree to receive SMS messages from ${businessName}. Message frequency varies. Message and data rates may apply. Reply STOP to opt out."

2. **Verbal Consent**: During phone consultations or in-person meetings, staff verbally confirm customer consent to receive SMS notifications and document this consent.

3. **Opt-In Keywords**: Customers can text START or OPTIN to our business number to subscribe to updates.

All opt-in methods clearly disclose:
- The type of messages to be received
- Message frequency (varies based on activity)
- "Message and data rates may apply"
- How to opt out (Reply STOP)
- Link to privacy policy

Opt-in is voluntary and not required to receive services.`;

    // Generate privacy policy SMS disclosure (required language)
    const privacyDisclosure = `${businessName} respects your privacy. We will never sell, rent, or share your mobile phone number with third parties for marketing purposes. Your information is used solely to provide you with the services you requested. You may opt out at any time by replying STOP to any message.`;

    return {
      suggestedUseCase,
      useCaseLabel: USE_CASE_TYPES.find(u => u.value === suggestedUseCase)?.label || 'Mixed/Low Volume',
      campaignDescription,
      sampleMessages,
      optInConfirmation,
      messageFlow,
      privacyDisclosure,
    };
  };

  const handleExpand = (clientId: string, data: A2PRegistrationData | null) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
    } else {
      setExpandedClient(clientId);
      if (data && !generatedTemplates[clientId]) {
        const templates = generateA2PTemplates(data);
        setGeneratedTemplates(prev => ({ ...prev, [clientId]: templates }));
      }
    }
  };

  const regenerateTemplates = (clientId: string, data: A2PRegistrationData) => {
    const templates = generateA2PTemplates(data);
    setGeneratedTemplates(prev => ({ ...prev, [clientId]: templates }));
  };

  const CopyButton: React.FC<{ text: string; fieldId: string }> = ({ text, fieldId }) => (
    <button
      onClick={() => copyToClipboard(text, fieldId)}
      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
      title="Copy to clipboard"
    >
      {copiedField === fieldId ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      ) : (
        <Copy className="w-4 h-4 text-slate-500" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">A2P Verification Automation</h1>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl">
            AI-assisted templates to help you complete A2P 10DLC campaign registration for your clients.
            These templates follow Twilio/TCR best practices for higher approval rates.
          </p>
        </div>

        {/* Best Practices Notice */}
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-800">
              <p className="font-bold mb-1">A2P 10DLC Best Practices</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Campaign description must explain WHO sends, WHO receives, and WHY messages are sent</li>
                <li>Sample messages MUST include business name and opt-out language (Reply STOP)</li>
                <li>Opt-in confirmation must be under 160 characters with frequency disclosure</li>
                <li>Privacy policy must state mobile info will NOT be shared with third parties</li>
              </ul>
            </div>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No pending A2P registrations</p>
            <p className="text-sm text-slate-400 mt-1">Clients with pending registrations will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => {
              const isExpanded = expandedClient === record.client_id;
              const templates = generatedTemplates[record.client_id];
              const data = record.a2p_registration_data;

              return (
                <div
                  key={record.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  {/* Header */}
                  <button
                    onClick={() => handleExpand(record.client_id, data)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-900">{record.clients.business_name}</p>
                        <p className="text-xs text-slate-500">
                          Submitted: {format(new Date(record.updated_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        record.a2p_status === 'pending_approval'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {record.a2p_status === 'pending_approval' ? 'Pending Review' : 'Not Started'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && data && (
                    <div className="border-t border-slate-100 p-6 space-y-6">
                      {/* Client Submitted Data */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" /> Client Submitted Data
                          </h3>
                          <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Legal Business Name</p>
                              <p className="text-slate-900">{data.legal_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Business Type</p>
                              <p className="text-slate-900">{data.business_type}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">EIN</p>
                              <p className="text-slate-900">{data.ein}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Website</p>
                              <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                                {data.website} <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Address</p>
                              <p className="text-slate-900">{data.address_street}, {data.address_city}, {data.address_state} {data.address_zip}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Contact</p>
                              <p className="text-slate-900">{data.contact_name} ({data.contact_email})</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-slate-500" /> Client's Messaging Intent
                          </h3>
                          <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Use Case Description</p>
                              <p className="text-slate-900">{data.use_case}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Sample Message (Client Provided)</p>
                              <p className="text-slate-900 italic">"{data.sample_message}"</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Generated Templates */}
                      {templates && (
                        <div className="space-y-6 pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-indigo-600" /> AI-Generated A2P Templates
                            </h3>
                            <button
                              onClick={() => regenerateTemplates(record.client_id, data)}
                              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <RefreshCw className="w-4 h-4" /> Regenerate
                            </button>
                          </div>

                          {/* Use Case Type */}
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-emerald-800">Recommended Use Case Type</p>
                              <CopyButton text={templates.suggestedUseCase} fieldId={`${record.client_id}-usecase`} />
                            </div>
                            <p className="text-emerald-900 font-semibold">{templates.useCaseLabel}</p>
                            <p className="text-xs text-emerald-700 mt-1">
                              TCR Code: <code className="bg-emerald-100 px-1 rounded">{templates.suggestedUseCase}</code>
                            </p>
                          </div>

                          {/* Campaign Description */}
                          <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-slate-900">Campaign Description</p>
                              <CopyButton text={templates.campaignDescription} fieldId={`${record.client_id}-desc`} />
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{templates.campaignDescription}</p>
                          </div>

                          {/* Sample Messages */}
                          <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <p className="text-sm font-bold text-slate-900 mb-3">Sample Messages (Include in Registration)</p>
                            <div className="space-y-3">
                              {templates.sampleMessages.map((msg: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg">
                                  <span className="text-xs font-bold text-slate-500 mt-0.5">{idx + 1}.</span>
                                  <p className="text-sm text-slate-700 flex-1">{msg}</p>
                                  <CopyButton text={msg} fieldId={`${record.client_id}-sample-${idx}`} />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Opt-In Confirmation */}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-amber-800">Opt-In Confirmation Message</p>
                              <CopyButton text={templates.optInConfirmation} fieldId={`${record.client_id}-optin`} />
                            </div>
                            <p className="text-sm text-amber-900">{templates.optInConfirmation}</p>
                            <p className="text-xs text-amber-700 mt-2">
                              Characters: {templates.optInConfirmation.length}/160
                              {templates.optInConfirmation.length > 160 && (
                                <span className="text-red-600 font-bold ml-2">Exceeds limit!</span>
                              )}
                            </p>
                          </div>

                          {/* Message Flow */}
                          <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-slate-900">Message Flow / Call-to-Action</p>
                              <CopyButton text={templates.messageFlow} fieldId={`${record.client_id}-flow`} />
                            </div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap prose prose-sm max-w-none">
                              {templates.messageFlow}
                            </div>
                          </div>

                          {/* Privacy Disclosure */}
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-purple-800">Privacy Policy SMS Disclosure</p>
                              <CopyButton text={templates.privacyDisclosure} fieldId={`${record.client_id}-privacy`} />
                            </div>
                            <p className="text-sm text-purple-900">{templates.privacyDisclosure}</p>
                            <p className="text-xs text-purple-700 mt-2">
                              Add this language to the client's privacy policy if not already present.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* External Resources */}
        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-sm font-bold text-slate-900 mb-2">Helpful Resources</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://help.twilio.com/articles/11847054539547-A2P-10DLC-Campaign-Approval-Requirements"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              Twilio A2P Requirements <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.twilio.com/docs/messaging/compliance/a2p-10dlc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              A2P 10DLC Documentation <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://support.twilio.com/hc/en-us/articles/4405758341659-A2P-10DLC-Brand-Approval-Best-Practices"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              Brand Approval Best Practices <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminA2PAutomation;
