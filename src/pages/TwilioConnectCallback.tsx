"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { ClientIntegrationService } from '../services/clientIntegrationService';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const TwilioConnectCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing Twilio Connect authorization...');

  const completeConnect = useCallback(async () => {
    const accountSid = searchParams.get('AccountSid');

    if (!accountSid) {
      setStatus('error');
      setMessage('Missing AccountSid from Twilio redirect. Please try connecting again.');
      return;
    }

    if (!profile) {
      setStatus('error');
      setMessage('You must be logged in to complete Twilio Connect.');
      return;
    }

    // Get the client_id for the logged-in user
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_profile_id', profile.id)
      .maybeSingle();

    if (clientError || !clientData) {
      setStatus('error');
      setMessage('Could not find your client account. Please contact support.');
      return;
    }

    try {
      const result = await ClientIntegrationService.completeTwilioConnect(
        clientData.id,
        accountSid
      );

      if (result.success) {
        setStatus('success');
        const numCount = result.phone_numbers?.length || 0;
        setMessage(
          `Twilio account connected successfully! Found ${numCount} phone number${numCount !== 1 ? 's' : ''}. Redirecting to settings...`
        );

        // Redirect back to settings after a brief delay
        setTimeout(() => {
          navigate('/client/settings', { replace: true });
        }, 2500);
      } else {
        setStatus('error');
        setMessage(result.error || 'Failed to complete Twilio Connect.');
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(`Connection failed: ${e.message}`);
    }
  }, [searchParams, profile, navigate]);

  useEffect(() => {
    if (profile) {
      completeConnect();
    }
  }, [profile, completeConnect]);

  return (
    <ClientLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 max-w-md text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Connecting Twilio</h2>
              <p className="text-sm text-slate-600">{message}</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Connected!</h2>
              <p className="text-sm text-emerald-700">{message}</p>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Failed</h2>
              <p className="text-sm text-red-700 mb-6">{message}</p>
              <button
                onClick={() => navigate('/client/settings', { replace: true })}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Back to Settings
              </button>
            </>
          )}
        </div>
      </div>
    </ClientLayout>
  );
};

export default TwilioConnectCallback;
