"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { AdminService } from '../services/adminService';

interface SmsMessage {
  id: string;
  client_id: string | null;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  twilio_message_sid: string | null;
  twilio_account_sid: string | null;
  received_at: string | null;
  created_at: string;
}

interface SmsInboxProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
}

const SmsInbox: React.FC<SmsInboxProps> = ({ clientId, clientName, clientPhone }) => {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await AdminService.getSmsMessages(clientId);
      setMessages(Array.isArray(data) ? data : []);
      setFetchError(null);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load messages.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 10000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;
    setSendError(null);
    setIsSending(true);

    // Normalize to E.164
    const to = clientPhone.startsWith('+') ? clientPhone : `+1${clientPhone.replace(/\D/g, '')}`;

    try {
      await AdminService.sendSms(to, messageBody.trim(), clientId);
      setMessageBody('');
      // Immediately refresh to show the sent message
      await fetchMessages();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[480px] bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <MessageSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-tight truncate">{clientName}</p>
          <p className="text-xs text-slate-500">{clientPhone || 'No phone on record'}</p>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : fetchError ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {fetchError}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
            <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Send the first message below</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] space-y-1`}>
                  <p className={`text-xs font-semibold ${isOutbound ? 'text-right text-indigo-500' : 'text-left text-slate-500'}`}>
                    {isOutbound ? 'You' : clientName}
                  </p>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      isOutbound
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-900 rounded-tl-sm'
                    }`}
                  >
                    {msg.body}
                  </div>
                  <p className={`text-[10px] text-slate-400 ${isOutbound ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div className="flex items-center gap-2 mx-4 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {sendError}
        </div>
      )}

      {/* Compose area */}
      <form onSubmit={handleSend} className="flex gap-2 items-end px-4 py-3 border-t border-slate-100">
        <textarea
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (messageBody.trim() && !isSending && clientPhone) handleSend(e as any);
            }
          }}
          placeholder={clientPhone ? 'Type a message… (Enter to send)' : 'No phone number on record'}
          rows={2}
          disabled={isSending || !clientPhone}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:border-indigo-500 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSending || !messageBody.trim() || !clientPhone}
          className="flex-shrink-0 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
};

export default SmsInbox;
