import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { GeneratingEffect } from '../src/tools/jet-local-optimizer/components/GeneratingEffect';
import { JetBizPro } from './tools/JetBizPro';

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

        {/* JetBiz Pro uses Stripe session metadata for the paid radius. */}
        {id ? (
          <JetBizPro sessionId={id} analyzing={analyzing} />
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 border border-red-200 text-red-700">
            Missing Pro session id.
          </div>
        )}
      </div>
    </div>
  );
}

