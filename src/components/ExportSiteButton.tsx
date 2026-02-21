import React, { useState } from 'react';
import { Download, Loader2, X, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface ExportResult {
  download_url: string;
  file_size_bytes: number;
  pages_exported: number;
  blog_posts_exported: number;
  expires_at: string;
}

interface ExportSiteButtonProps {
  clientId: string;
  businessName: string;
}

// ─── Download-ready modal ─────────────────────────────────────────────────────

interface DownloadModalProps {
  result: ExportResult;
  businessName: string;
  onClose: () => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ result, businessName, onClose }) => {
  const fileSizeMb = (result.file_size_bytes / 1024 / 1024).toFixed(2);
  const expiresAt = new Date(result.expires_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleDownload = () => {
    // Trigger browser download by navigating to the signed URL
    const a = document.createElement('a');
    a.href = result.download_url;
    a.download = `${businessName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-site-export.zip`;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Download Ready</h2>
            <p className="text-sm text-slate-500">{businessName} — complete site export</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-900">{result.pages_exported}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {result.pages_exported === 1 ? 'Page' : 'Pages'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-900">{result.blog_posts_exported}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {result.blog_posts_exported === 1 ? 'Blog Post' : 'Blog Posts'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-900">{fileSizeMb}</div>
            <div className="text-xs text-slate-500 mt-0.5">MB</div>
          </div>
        </div>

        {/* What's inside */}
        <div className="bg-indigo-50 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">What's included</p>
          <ul className="text-sm text-indigo-900 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-indigo-400">✓</span> Complete static HTML/CSS website
            </li>
            <li className="flex items-center gap-2">
              <span className="text-indigo-400">✓</span> All {result.pages_exported} {result.pages_exported === 1 ? 'page' : 'pages'} with inline Tailwind CDN
            </li>
            {result.blog_posts_exported > 0 && (
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span> {result.blog_posts_exported} blog {result.blog_posts_exported === 1 ? 'post' : 'posts'} as static HTML
              </li>
            )}
            <li className="flex items-center gap-2">
              <span className="text-indigo-400">✓</span> README.txt with deployment instructions
            </li>
          </ul>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Download ZIP
        </button>

        {/* Expiry note */}
        <p className="mt-3 text-center text-xs text-slate-400">
          Link expires {expiresAt}. Re-export any time to get a fresh link.
        </p>
      </div>
    </div>
  );
};

// ─── Main button component ────────────────────────────────────────────────────

const ExportSiteButton: React.FC<ExportSiteButtonProps> = ({ clientId, businessName }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('export-site-zip', {
        body: { client_id: clientId },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      if (response.error) {
        throw new Error(response.error.message || 'Export failed');
      }

      const data = response.data as { success: boolean; download_url: string } & ExportResult;

      if (!data.success || !data.download_url) {
        throw new Error('Export completed but no download URL was returned.');
      }

      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Generate a downloadable ZIP of the client's complete static website"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
          {isLoading ? 'Generating…' : 'Export Site'}
        </button>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 max-w-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && (
        <DownloadModal
          result={result}
          businessName={businessName}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
};

export default ExportSiteButton;
