import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Zap } from 'lucide-react';

// Baseline versions we ship with — update these when you upgrade locally
const BASELINE_VERSIONS = {
  supabase_cli: '2.1.4',
  claude_code: '1.0.21',
};

interface VersionInfo {
  supabase_cli_latest: string;
  claude_code_latest: string;
}

interface CopyButtonProps {
  text: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy: ${text}`}
      className="inline-flex items-center gap-1 font-mono text-xs bg-amber-900/20 hover:bg-amber-900/30 text-amber-900 px-2 py-0.5 rounded border border-amber-300/50 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {text}
    </button>
  );
};

function isNewerVersion(latest: string, baseline: string): boolean {
  if (!latest || latest === 'unavailable' || latest === 'unknown') return false;
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const l = parse(latest);
  const b = parse(baseline);
  for (let i = 0; i < Math.max(l.length, b.length); i++) {
    const lv = l[i] ?? 0;
    const bv = b[i] ?? 0;
    if (lv > bv) return true;
    if (lv < bv) return false;
  }
  return false;
}

interface UpdateNotificationBannerProps {
  fetchVersions: () => Promise<VersionInfo>;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({ fetchVersions }) => {
  const [versions, setVersions] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem('cwp_update_banner_dismissed') === 'true') {
      setDismissed(true);
      setLoading(false);
      return;
    }

    fetchVersions()
      .then(data => {
        setVersions(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [fetchVersions]);

  const handleDismiss = () => {
    sessionStorage.setItem('cwp_update_banner_dismissed', 'true');
    setDismissed(true);
  };

  if (loading || dismissed || !versions) return null;

  const hasSupabaseUpdate = isNewerVersion(versions.supabase_cli_latest, BASELINE_VERSIONS.supabase_cli);
  const hasClaudeUpdate = isNewerVersion(versions.claude_code_latest, BASELINE_VERSIONS.claude_code);

  if (!hasSupabaseUpdate && !hasClaudeUpdate) return null;

  const updates: React.ReactNode[] = [];
  if (hasSupabaseUpdate) {
    updates.push(
      <span key="supabase">
        Supabase CLI{' '}
        <span className="line-through text-amber-600">v{BASELINE_VERSIONS.supabase_cli}</span>
        {' → '}
        <strong>v{versions.supabase_cli_latest}</strong>
      </span>
    );
  }
  if (hasClaudeUpdate) {
    updates.push(
      <span key="claude">
        Claude Code{' '}
        <span className="line-through text-amber-600">v{BASELINE_VERSIONS.claude_code}</span>
        {' → '}
        <strong>v{versions.claude_code_latest}</strong>
      </span>
    );
  }

  return (
    <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="flex items-center gap-3 max-w-7xl mx-auto flex-wrap">
        <div className="flex items-center gap-1.5 text-amber-800">
          <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-semibold">Updates Available:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-amber-800">
          {updates.map((u, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-amber-400">|</span>}
              {u}
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {hasSupabaseUpdate && (
            <CopyButton text="supabase update" />
          )}
          {hasClaudeUpdate && (
            <CopyButton text="npm i -g claude-code@latest" />
          )}
          <button
            onClick={handleDismiss}
            className="ml-1 text-amber-600 hover:text-amber-800 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotificationBanner;
