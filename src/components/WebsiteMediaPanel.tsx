import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Copy, Trash2, CheckCircle, Loader2, ImageIcon,
  AlertTriangle, X, FolderOpen,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaAsset {
  name: string;        // filename in storage
  fullPath: string;    // {clientId}/{category}/{name}
  publicUrl: string;
  size: number;
  createdAt: string;
}

interface Category {
  id: string;
  label: string;
  hint: string;
  accept: string;     // MIME types for file input
  maxMB: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BUCKET = 'website-images';

const CATEGORIES: Category[] = [
  { id: 'logo',    label: 'Logo',          hint: 'PNG/SVG with transparency recommended', accept: 'image/*',           maxMB: 5  },
  { id: 'favicon', label: 'Favicon',       hint: '.ico, PNG 32×32 or 64×64',              accept: 'image/*,.ico',      maxMB: 1  },
  { id: 'hero',    label: 'Hero / Banner', hint: 'Wide images, 1920×600+ px',             accept: 'image/*',           maxMB: 10 },
  { id: 'about',   label: 'About Us',      hint: 'Team photo, office, storefront',        accept: 'image/*',           maxMB: 10 },
  { id: 'staff',   label: 'Staff / Team',  hint: 'Individual headshots',                  accept: 'image/*',           maxMB: 5  },
  { id: 'gallery', label: 'Gallery',       hint: 'Portfolio, project, product photos',    accept: 'image/*',           maxMB: 10 },
  { id: 'general', label: 'General',       hint: 'Any other images',                      accept: 'image/*',           maxMB: 10 },
];

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

export default function WebsiteMediaPanel({ clientId }: Props) {
  const [activeCategory, setActiveCategory] = useState('logo');
  const [assets, setAssets] = useState<Record<string, MediaAsset[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<MediaAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cat = CATEGORIES.find(c => c.id === activeCategory)!;
  const currentAssets = assets[activeCategory] ?? [];

  // ── Fetch assets for a category ──────────────────────────────────────────

  const fetchCategory = useCallback(async (categoryId: string) => {
    if (!clientId) return;
    setLoading(true);
    const prefix = `${clientId}/${categoryId}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data) {
      setAssets(prev => ({ ...prev, [categoryId]: [] }));
      setLoading(false);
      return;
    }

    const mapped: MediaAsset[] = data
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(f => {
        const fullPath = `${prefix}/${f.name}`;
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
        return {
          name: f.name,
          fullPath,
          publicUrl,
          size: f.metadata?.size ?? 0,
          createdAt: f.created_at ?? '',
        };
      });

    setAssets(prev => ({ ...prev, [categoryId]: mapped }));
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (clientId) fetchCategory(activeCategory);
  }, [clientId, activeCategory, fetchCategory]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !clientId) return;
    setUploadError(null);
    setUploading(true);

    const maxBytes = cat.maxMB * 1024 * 1024;
    const uploaded: MediaAsset[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        errors.push(`${file.name} exceeds ${cat.maxMB} MB limit`);
        continue;
      }

      // Sanitize filename and make unique
      const ext = file.name.split('.').pop() ?? 'bin';
      const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      const uniqueName = `${Date.now()}-${base}.${ext}`;
      const storagePath = `${clientId}/${activeCategory}/${uniqueName}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (error) {
        errors.push(`${file.name}: ${error.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      uploaded.push({
        name: uniqueName,
        fullPath: storagePath,
        publicUrl,
        size: file.size,
        createdAt: new Date().toISOString(),
      });

      // Save record to database so the AI and back office can reference it
      await supabase.from('website_media_assets').insert({
        client_id: clientId,
        category: activeCategory,
        file_name: uniqueName,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
      });
    }

    if (uploaded.length > 0) {
      setAssets(prev => ({
        ...prev,
        [activeCategory]: [...uploaded, ...(prev[activeCategory] ?? [])],
      }));
    }
    if (errors.length > 0) setUploadError(errors.join(' · '));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag-and-drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (asset: MediaAsset) => {
    setDeletingPath(asset.fullPath);
    const { error } = await supabase.storage.from(BUCKET).remove([asset.fullPath]);
    if (!error) {
      setAssets(prev => ({
        ...prev,
        [activeCategory]: (prev[activeCategory] ?? []).filter(a => a.fullPath !== asset.fullPath),
      }));
    }
    setDeletingPath(null);
  };

  // ── Copy URL ──────────────────────────────────────────────────────────────

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (!clientId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        Select a client to manage media assets.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">

      {/* Header */}
      <div className="flex-none px-5 pt-5 pb-3 border-b border-slate-800">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
          <ImageIcon className="w-4 h-4 text-indigo-400" /> Media Library
        </h3>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === c.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {c.label}
              {(assets[c.id]?.length ?? 0) > 0 && (
                <span className={`ml-1.5 px-1.5 py-0 rounded-full text-[10px] font-bold ${
                  activeCategory === c.id ? 'bg-white/20' : 'bg-slate-700 text-slate-300'
                }`}>
                  {assets[c.id].length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div className="flex-none px-5 py-3 border-b border-slate-800">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 cursor-pointer transition-colors ${
            uploading
              ? 'border-indigo-700 bg-indigo-950/30'
              : 'border-slate-700 hover:border-indigo-600 hover:bg-slate-900'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <p className="text-xs text-indigo-400">Uploading…</p>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-slate-500" />
              <p className="text-xs text-slate-400">
                Drop files here or <span className="text-indigo-400 font-medium">click to upload</span>
              </p>
              <p className="text-[10px] text-slate-600">{cat.hint} · max {cat.maxMB} MB</p>
            </>
          )}
        </div>

        {/* Hidden file input — multi-select */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={cat.accept}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />

        {/* Upload error */}
        {uploadError && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="flex-shrink-0 hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : currentAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No {cat.label} images yet</p>
            <p className="text-slate-600 text-xs mt-1">{cat.hint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {currentAssets.map(asset => {
              const isDeleting = deletingPath === asset.fullPath;
              const isCopied = copiedUrl === asset.publicUrl;
              return (
                <div
                  key={asset.fullPath}
                  className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative aspect-video bg-slate-800 cursor-zoom-in overflow-hidden"
                    onClick={() => setLightbox(asset)}
                  >
                    <img
                      src={asset.publicUrl}
                      alt={asset.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = ''; }}
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-white text-[10px] font-medium bg-black/60 px-2 py-1 rounded">
                        Click to enlarge
                      </span>
                    </div>
                  </div>

                  {/* Info + actions */}
                  <div className="px-2.5 py-2 flex flex-col gap-1.5">
                    <p className="text-slate-300 text-[11px] font-mono truncate" title={asset.name}>
                      {asset.name.replace(/^\d+-/, '')}
                    </p>
                    <p className="text-slate-600 text-[10px]">{fmtBytes(asset.size)}</p>

                    <div className="flex gap-1.5 mt-0.5">
                      {/* Copy URL */}
                      <button
                        onClick={() => copyUrl(asset.publicUrl)}
                        title="Copy public URL"
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          isCopied
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {isCopied
                          ? <><CheckCircle className="w-3 h-3" /> Copied</>
                          : <><Copy className="w-3 h-3" /> Copy URL</>
                        }
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(asset)}
                        disabled={isDeleting}
                        title="Delete"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-slate-700 hover:border-red-900 transition-colors"
                      >
                        {isDeleting
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Image */}
            <div className="bg-slate-950 flex items-center justify-center p-4" style={{ minHeight: 300 }}>
              <img
                src={lightbox.publicUrl}
                alt={lightbox.name}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-between gap-4 border-t border-slate-800">
              <div className="min-w-0">
                <p className="text-slate-200 text-sm font-mono truncate">{lightbox.name.replace(/^\d+-/, '')}</p>
                <p className="text-slate-500 text-xs mt-0.5">{fmtBytes(lightbox.size)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => copyUrl(lightbox.publicUrl)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    copiedUrl === lightbox.publicUrl
                      ? 'bg-emerald-800 text-emerald-300'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {copiedUrl === lightbox.publicUrl
                    ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy URL</>
                  }
                </button>
                <a
                  href={lightbox.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  Open
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
