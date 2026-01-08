"use client";

import React, { useState, useEffect } from 'react';
import { X, Loader2, Send, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdminService } from '../services/adminService';

interface SendSmsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
}

const SendSmsDialog: React.FC<SendSmsDialogProps> = ({ isOpen, onClose, clientName, clientPhone }) => {
  const [messageBody, setMessageBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessageBody('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    if (!clientPhone) {
      setError(`Client phone number is missing for ${clientName}. Cannot send SMS.`);
      setIsLoading(false);
      return;
    }
    
    // Twilio requires E.164 format (e.g., +14045551234). We assume the stored phone number is clean or Twilio handles basic formatting.
    const to = clientPhone.startsWith('+') ? clientPhone : `+1${clientPhone.replace(/\D/g, '')}`;

    try {
      await AdminService.sendSms(to, messageBody);
      setSuccess(true);
      setTimeout(onClose, 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-indigo-600" /> Send SMS to Client
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        {success ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
                <h4 className="font-bold text-emerald-800 mb-2">Message Sent!</h4>
                <p className="text-sm text-emerald-700">The SMS has been successfully delivered to {clientName}.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Recipient Info */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <p className="font-bold text-slate-700">Recipient: {clientName}</p>
                    <p className="text-xs text-slate-500">Phone: {clientPhone || 'N/A (Update client record)'}</p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Message Body</label>
                    <textarea
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        placeholder="Type your message here..."
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none focus:border-indigo-500 outline-none"
                        required
                        disabled={isLoading || !clientPhone}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !clientPhone}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Send SMS
                        </>
                    )}
                </button>
            </form>
        )}
      </div>
    </div>
  );
};

export default SendSmsDialog;