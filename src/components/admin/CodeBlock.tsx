import React, { useState } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  suggestedPath?: string;
  showCopy?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'typescript',
  suggestedPath,
  showCopy = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 text-sm font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-slate-400" />
          {suggestedPath ? (
            <span className="text-xs text-slate-300 font-mono">{suggestedPath}</span>
          ) : (
            <span className="text-xs text-slate-400">{language}</span>
          )}
        </div>
        {showCopy && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      {/* Code content */}
      <pre className="p-4 overflow-x-auto text-slate-300 leading-relaxed whitespace-pre text-xs">
        <code>{code}</code>
      </pre>
    </div>
  );
};

interface FileWritePreviewProps {
  path: string;
  content: string;
  description: string;
  isNewFile?: boolean;
  onApprove: () => void;
  onReject: () => void;
  resolved?: boolean;
  resolution?: 'approved' | 'rejected';
}

export const FileWritePreview: React.FC<FileWritePreviewProps> = ({
  path,
  content,
  description,
  isNewFile = true,
  onApprove,
  onReject,
  resolved = false,
  resolution,
}) => {
  const [showFull, setShowFull] = useState(false);
  const lines = content.split('\n');
  const previewLines = showFull ? lines : lines.slice(0, 20);
  const hasMore = lines.length > 20;

  if (resolved) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        {resolution === 'approved' ? (
          <>
            <span className="text-emerald-500">✓</span> File written to GitHub
          </>
        ) : (
          <>
            <span className="text-slate-400">✗</span> File write rejected
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
        <span className="text-amber-600">📁</span>
        <span className="font-semibold text-sm text-amber-800">File Write</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
          {isNewFile ? 'New File' : 'Update File'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* File path */}
        <div className="font-mono text-xs text-amber-900 bg-amber-100 rounded-lg px-3 py-2 border border-amber-200">
          {path}
        </div>

        {/* Description */}
        <p className="text-sm text-amber-800">{description}</p>

        {/* Code preview */}
        <div className="rounded-lg overflow-hidden border border-amber-200 bg-slate-950">
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">{path}</span>
            <span className="text-xs text-slate-500">{lines.length} lines</span>
          </div>
          <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
            {previewLines.map((line, i) => (
              <div
                key={i}
                className={isNewFile ? 'text-emerald-400' : 'text-slate-300'}
              >
                <span className="text-slate-600 select-none mr-3">{i + 1}</span>
                {isNewFile && <span className="text-emerald-600 select-none mr-1">+</span>}
                {line}
              </div>
            ))}
            {hasMore && !showFull && (
              <div className="text-slate-500 mt-1">
                ... {lines.length - 20} more lines
              </div>
            )}
          </pre>
        </div>

        {hasMore && (
          <button
            onClick={() => setShowFull(f => !f)}
            className="text-xs text-amber-600 hover:text-amber-800 transition-colors"
          >
            {showFull ? 'Show less' : `Show all ${lines.length} lines`}
          </button>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            ✓ Write File
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeBlock;
