import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { WebsiteGlobal } from '../../../types/website';

interface ChatWidgetSectionProps {
  global: WebsiteGlobal;
}

/**
 * Renders a floating chat widget placeholder.
 *
 * The outer div carries id="cwp-chat-widget" so that third-party chat
 * scripts (e.g. Intercom, Crisp, a custom AI chatbot) can locate and
 * attach themselves to this element at runtime.
 *
 * When no external script is injected the component renders a built-in
 * placeholder bubble so the feature is visually present during preview.
 */
const ChatWidgetSection: React.FC<ChatWidgetSectionProps> = ({ global: g }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      id="cwp-chat-widget"
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      data-cwp-widget="chat"
    >
      {/* Placeholder chat panel (shown until a real widget takes over) */}
      {open && (
        <div
          className="w-80 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 bg-white"
          role="dialog"
          aria-label="Chat"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ backgroundColor: g.primary_color }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight" style={{ fontFamily: g.font_heading }}>
                  {g.business_name}
                </p>
                <p className="text-white/70 text-xs">We reply promptly</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-6 bg-slate-50 min-h-[180px] flex flex-col items-center justify-center text-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${g.primary_color}15` }}
            >
              <MessageCircle className="w-6 h-6" style={{ color: g.primary_color }} />
            </div>
            <p className="text-slate-700 font-medium text-sm" style={{ fontFamily: g.font_body }}>
              Hi there! How can we help you today?
            </p>
            <p className="text-slate-400 text-xs">
              Send us a message and we'll get back to you.
            </p>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-2">
            <input
              type="text"
              placeholder="Type a message…"
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-offset-1 transition-all"
              style={{ '--tw-ring-color': `${g.primary_color}50` } as React.CSSProperties}
              readOnly
            />
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: g.primary_color }}
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.288a.75.75 0 00-.826.95l1.414 4.926A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.897 28.897 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.288z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-offset-2"
        style={{
          backgroundColor: g.primary_color,
          '--tw-ring-color': `${g.primary_color}40`,
        } as React.CSSProperties}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open
          ? <X className="w-6 h-6" />
          : <MessageCircle className="w-6 h-6" />
        }
      </button>
    </div>
  );
};

export default ChatWidgetSection;
