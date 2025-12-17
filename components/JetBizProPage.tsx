import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { GeneratingEffect } from '../src/tools/jet-local-optimizer/components/GeneratingEffect';
import { JetBiz } from './tools/JetBiz';

const UPGRADE_CONTEXT_KEY = 'jetbiz_upgrade_context_v1';

export default function JetBizProPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const analyzing = searchParams.get('analyzing') === 'true';
  const [showIntro, setShowIntro] = useState(analyzing);

  useEffect(() => {
    if (!analyzing) return;
    const t = window.setTimeout(() => setShowIntro(false), 1200);
    return () => window.clearTimeout(t);
  }, [analyzing]);

  const context = useMemo(() => {
    try {
      const raw = localStorage.getItem(UPGRADE_CONTEXT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="text-xs font-mono text-slate-500">
            JetBiz Pro Session: <span className="font-bold">{id}</span>
          </div>
          <Link to="/jetsuite" className="text-indigo-600 hover:text-indigo-800 font-medium">
            ← Back to JetSuite
          </Link>
        </div>

        {showIntro && (
          <div className="mb-6">
            <GeneratingEffect
              theme="light"
              durationMs={5000}
              title="Starting JetBiz Pro…"
              subtitle="Preparing competitor benchmarking and a full report."
              steps={[
                'Loading Places engine…',
                'Preparing competitor scan…',
                'Warming up analysis…',
                'Building report structure…',
                'Launching Pro audit…',
              ]}
            />
          </div>
        )}

        {/* JetBiz reads the upgrade context from localStorage and runs in Pro (10 competitors). */}
        <JetBiz />

        {!context && (
          <div className="mt-6 text-xs text-slate-500">
            Note: No upgrade context found in localStorage. You can still run JetBiz Pro manually by searching for your business.
          </div>
        )}
      </div>
    </div>
  );
}

