import React, { useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface GeneratingEffectProps {
  durationMs?: number;
  title?: string;
  subtitle?: string;
  theme?: Theme;
  steps?: string[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function GeneratingEffect({
  durationMs = 5000,
  title = 'Generating report…',
  subtitle = 'Running checks and assembling your results.',
  theme = 'light',
  steps = [
    'Initializing scan',
    'Measuring performance signals',
    'Parsing structure & metadata',
    'Computing score model',
    'Finalizing dashboard'
  ]
}: GeneratingEffectProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const t = clamp01(durationMs > 0 ? elapsed / durationMs : 1);
      // Ease-out curve so it feels "smart" (fast early, slow at end).
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [durationMs, startedAt]);

  useEffect(() => {
    if (!steps.length) return;
    const intervalMs = Math.max(450, Math.floor(durationMs / steps.length));
    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [durationMs, steps.length]);

  const isDark = theme === 'dark';
  const surface = isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900';
  const muted = isDark ? 'text-slate-300' : 'text-slate-600';
  const subtle = isDark ? 'bg-white/10' : 'bg-slate-100';
  const track = isDark ? 'bg-white/10' : 'bg-slate-200';
  const bar = isDark ? 'bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400' : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-600';

  return (
    <div className={`rounded-2xl border p-6 shadow-lg ${surface}`} aria-live="polite" aria-busy="true">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${subtle}`}>
          <div className={`w-4 h-4 border-2 ${isDark ? 'border-white/30 border-t-white' : 'border-slate-400/40 border-t-slate-900'} rounded-full animate-spin`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-bold tracking-tight truncate">{title}</div>
              <div className={`text-sm mt-1 ${muted}`}>{subtitle}</div>
            </div>
            <div className={`text-xs font-mono tabular-nums ${muted}`}>{progress}%</div>
          </div>

          <div className={`mt-4 h-2 rounded-full overflow-hidden ${track}`}>
            <div className={`h-full rounded-full ${bar} transition-[width] duration-150`} style={{ width: `${progress}%` }} />
          </div>

          {steps.length > 0 && (
            <div className={`mt-3 text-xs font-mono uppercase tracking-wider ${muted}`}>
              <span className="inline-flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-600 animate-pulse'}`} />
                {steps[stepIndex]}
              </span>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div className={`h-4 rounded ${isDark ? 'bg-white/10' : 'bg-slate-100'} animate-pulse`} />
            <div className={`h-4 rounded w-5/6 ${isDark ? 'bg-white/10' : 'bg-slate-100'} animate-pulse`} />
            <div className={`h-4 rounded w-2/3 ${isDark ? 'bg-white/10' : 'bg-slate-100'} animate-pulse`} />
          </div>
        </div>
      </div>
    </div>
  );
}

