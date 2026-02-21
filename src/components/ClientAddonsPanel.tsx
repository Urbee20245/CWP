import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  FileText,
  MessageCircle,
  Newspaper,
  Phone,
  ShieldCheck,
  Globe,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Add-on catalogue ─────────────────────────────────────────────────────────

type AddonKey = 'calendar' | 'forms' | 'chat' | 'blog' | 'voice' | 'legal';

interface AddonDef {
  key: AddonKey;
  label: string;
  description: string;
  Icon: React.FC<{ className?: string }>;
  iconCls: string; // Tailwind text + bg classes for the icon badge
}

const ADDONS: AddonDef[] = [
  {
    key: 'calendar',
    label: 'Booking Calendar',
    description: 'Cal.com appointment scheduling widget embedded on the client\'s public site.',
    Icon: CalendarDays,
    iconCls: 'text-violet-600 bg-violet-50',
  },
  {
    key: 'forms',
    label: 'Contact Forms',
    description: 'Lead-capture contact form with spam protection and CRM routing.',
    Icon: FileText,
    iconCls: 'text-blue-600 bg-blue-50',
  },
  {
    key: 'chat',
    label: 'AI Chat Widget',
    description: 'Floating chatbot widget on the client\'s public website for instant visitor engagement.',
    Icon: MessageCircle,
    iconCls: 'text-emerald-600 bg-emerald-50',
  },
  {
    key: 'blog',
    label: 'Blog / News',
    description: 'AI-generated blog posts section with automated publishing and category tagging.',
    Icon: Newspaper,
    iconCls: 'text-amber-600 bg-amber-50',
  },
  {
    key: 'voice',
    label: 'AI Phone Receptionist',
    description: 'Retell AI voice agent that answers inbound calls 24/7 and qualifies leads.',
    Icon: Phone,
    iconCls: 'text-red-600 bg-red-50',
  },
  {
    key: 'legal',
    label: 'Legal Pages',
    description: 'AI-generated privacy policy, terms of service, and refund policy pages.',
    Icon: ShieldCheck,
    iconCls: 'text-slate-600 bg-slate-100',
  },
];

// Set used to filter unknown keys from DB
const VALID_KEYS = new Set<string>(ADDONS.map(a => a.key));

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';

interface ToastState {
  type: ToastType;
  message: string;
}

const Toast: React.FC<ToastState & { onDismiss: () => void }> = ({
  type,
  message,
  onDismiss,
}) => (
  <div
    className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all ${
      type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-red-50 border-red-200 text-red-800'
    }`}
  >
    {type === 'success' ? (
      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
    ) : (
      <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
    )}
    <span className="flex-1">{message}</span>
    <button
      onClick={onDismiss}
      className="ml-2 opacity-60 hover:opacity-100 transition-opacity text-xs leading-none"
      aria-label="Dismiss"
    >
      ✕
    </button>
  </div>
);

// ─── Toggle switch ────────────────────────────────────────────────────────────

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={`${label} toggle`}
    onClick={e => {
      e.stopPropagation();
      onChange();
    }}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
      checked ? 'bg-indigo-600' : 'bg-slate-200'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface ClientAddonsPanelProps {
  clientId: string;
}

const ClientAddonsPanel: React.FC<ClientAddonsPanelProps> = ({ clientId }) => {
  const [briefId, setBriefId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<AddonKey>>(new Set());
  /** Track what was last saved so we can show a dirty indicator */
  const savedRef = useRef<Set<AddonKey>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: ToastType, message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const fetchFeatures = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('website_briefs')
      .select('id, premium_features')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      showToast('error', `Failed to load add-ons: ${error.message}`);
      setIsLoading(false);
      return;
    }

    if (data) {
      setBriefId(data.id);
      const raw = (data.premium_features as string[]) ?? [];
      const valid = new Set<AddonKey>(
        raw.filter((k): k is AddonKey => VALID_KEYS.has(k))
      );
      setEnabled(valid);
      savedRef.current = new Set(valid);
    }

    setIsLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchFeatures();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [fetchFeatures]);

  const toggle = (key: AddonKey) => {
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /**
   * Commits all toggles to Supabase in a single PATCH (UPDATE).
   * The premium_features column is overwritten with the full new array.
   */
  const handleSave = async () => {
    if (!briefId) {
      showToast('error', 'No website brief found for this client. Generate the website first.');
      return;
    }

    setIsSaving(true);

    const featureArray = Array.from(enabled);

    const { error } = await supabase
      .from('website_briefs')
      .update({ premium_features: featureArray })
      .eq('id', briefId);

    setIsSaving(false);

    if (error) {
      showToast('error', `Failed to save: ${error.message}`);
    } else {
      savedRef.current = new Set(enabled);
      showToast('success', 'Add-ons saved successfully!');
    }
  };

  // ── Render: loading ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-sm">Loading add-ons…</p>
      </div>
    );
  }

  // ── Render: no brief ─────────────────────────────────────────────────────────

  if (!briefId) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
          <Globe className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="font-semibold text-slate-700 mb-1">No website brief found</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Generate a website for this client first — add-ons appear here once a
          brief exists.
        </p>
      </div>
    );
  }

  // ── Render: panel ────────────────────────────────────────────────────────────

  const isDirty = ADDONS.some(a => enabled.has(a.key) !== savedRef.current.has(a.key));

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Add-on cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ADDONS.map(({ key, label, description, Icon, iconCls }) => {
          const isOn = enabled.has(key);
          return (
            <div
              key={key}
              onClick={() => toggle(key)}
              className={`group relative flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer select-none transition-all duration-150 ${
                isOn
                  ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              {/* Icon badge */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconCls}`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-slate-900">{label}</span>
                  <span
                    className={`px-2 py-px rounded-full text-xs font-bold leading-5 ${
                      isOn
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isOn ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
              </div>

              {/* Toggle */}
              <div className="flex-shrink-0 mt-0.5">
                <ToggleSwitch checked={isOn} onChange={() => toggle(key)} label={label} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: count + save */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          {enabled.size} of {ADDONS.length} add-ons active
          {isDirty && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
              · unsaved changes
            </span>
          )}
        </p>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ClientAddonsPanel;
