"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Send, MessageSquare, AlertCircle, Smile } from 'lucide-react';
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

const EMOJIS = [
  // Smileys
  '😊', '😂', '😍', '🥰', '😘', '😁', '😄', '😅', '🤣', '😎',
  '🤩', '😏', '😒', '😔', '😢', '😭', '😡', '🤔', '🙄', '😴',
  // Gestures
  '👍', '👎', '👋', '🤝', '👏', '🙌', '🤞', '✌️', '🤟', '💪',
  // Hearts
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💞',
  // Objects
  '🎉', '🎊', '🎁', '🎂', '🔥', '✨', '💫', '⭐', '🌟', '🎵',
  // Symbols
  '✅', '❌', '⚠️', '💯', '🔔', '📱', '💬', '📢', '🆗', '🚀',
];

const SmsInbox: React.FC<SmsInboxProps> = ({ clientId, clientName, clientPhone }) => {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [textareaRows, setTextareaRows] = useState(2);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef<number>(0);

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

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

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
      setTextareaRows(2);
      // Immediately refresh to show the sent message
      await fetchMessages();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    const pos = cursorPosRef.current;
    const before = messageBody.slice(0, pos);
    const after = messageBody.slice(pos);
    const newBody = before + emoji + after;
    setMessageBody(newBody);
    // Restore focus and position cursor after inserted emoji
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = pos + emoji.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
        cursorPosRef.current = newPos;
      }
    }, 0);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageBody(e.target.value);
    cursorPosRef.current = e.target.selectionStart ?? e.target.value.length;
    // Auto-expand rows (2 default, up to 4)
    const lines = e.target.value.split('\n').length;
    setTextareaRows(Math.min(4, Math.max(2, lines)));
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

  const charCount = messageBody.length;
  const charCountColor =
    charCount >= 160 ? 'text-red-600' : charCount >= 140 ? 'text-amber-500' : 'text-slate-400';

  return (
    <div className="max-w-2xl mx-auto flex flex-col bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <MessageSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-tight truncate">{clientName}</p>
          <p className="text-xs text-slate-500">{clientPhone || 'No phone on record'}</p>
        </div>
      </div>

      {/* Message thread — fixed height, scrollable */}
      <div className="h-96 overflow-y-auto px-4 py-4 space-y-3">
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
                <div className="max-w-[75%] space-y-1">
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
      <div className="border-t border-slate-100 px-4 py-3">
        {/* Emoji picker popover anchor */}
        <div ref={emojiPickerRef} className="relative">
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-5 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-xl p-1 hover:bg-slate-100 rounded-lg transition-colors leading-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 items-end">
            {/* Emoji toggle button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="flex-shrink-0 p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50"
              title="Insert emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Textarea + char counter */}
            <div className="flex-1 flex flex-col gap-1">
              <textarea
                ref={textareaRef}
                value={messageBody}
                onChange={handleTextareaChange}
                onSelect={(e) => {
                  cursorPosRef.current = (e.target as HTMLTextAreaElement).selectionStart;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (messageBody.trim() && !isSending && clientPhone) handleSend(e as any);
                  }
                }}
                placeholder={clientPhone ? 'Type a message… (Enter to send)' : 'No phone number on record'}
                rows={textareaRows}
                spellCheck={true}
                lang="en"
                disabled={isSending || !clientPhone}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:border-indigo-500 outline-none disabled:opacity-50"
              />
              <p className={`text-xs text-right ${charCountColor}`}>{charCount} / 160</p>
            </div>

            {/* Send button */}
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
      </div>
    </div>
  );
};

export default SmsInbox;
