"use client";

import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Loader2, AlertCircle, Database, Code2, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProvisioningStep {
  id: string;
  resource_type: 'table' | 'sql' | 'storage_bucket' | 'provision_complete' | string;
  resource_name: string;
  status: 'created' | 'skipped' | 'error';
  details?: Record<string, any>;
  created_at: string;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function ResourceIcon({ type }: { type: string }) {
  switch (type) {
    case 'table':   return <Database className="w-4 h-4 text-indigo-400" />;
    case 'sql':     return <Code2 className="w-4 h-4 text-purple-400" />;
    case 'storage_bucket': return <Upload className="w-4 h-4 text-teal-400" />;
    default:        return <Sparkles className="w-4 h-4 text-amber-400" />;
  }
}

function StatusIcon({ status, loading }: { status: string; loading?: boolean }) {
  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />;
  if (status === 'created') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
  if (status === 'skipped') return <CheckCircle className="w-4 h-4 text-slate-400" />;
  return <AlertCircle className="w-4 h-4 text-red-400" />;
}

function resourceLabel(type: string): string {
  switch (type) {
    case 'table':          return 'Table created';
    case 'sql':            return 'SQL executed';
    case 'storage_bucket': return 'Storage bucket';
    default:               return 'Provisioned';
  }
}

// ─── Hook: subscribe to ai_provisioned_resources ──────────────────────────────

export function useProvisioningSteps(clientId: string | null, active: boolean) {
  const [steps, setSteps] = useState<ProvisioningStep[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!clientId || !active) {
      setSteps([]);
      return;
    }

    // Initial fetch of any already-created resources
    supabase
      .from('ai_provisioned_resources')
      .select('id, resource_type, resource_name, status, details, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data?.length) setSteps(data as ProvisioningStep[]);
      });

    // Realtime subscription for new resources as they're created
    const channel = supabase
      .channel(`provisioning-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_provisioned_resources',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as ProvisioningStep;
          setSteps(prev => {
            if (prev.some(s => s.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clientId, active]);

  return { steps, clear: () => setSteps([]) };
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface ProvisioningProgressProps {
  steps: ProvisioningStep[];
  aiProviderLabel?: string;
  isActive: boolean;
  /** Called when the user dismisses the panel */
  onDismiss?: () => void;
}

const ProvisioningProgress: React.FC<ProvisioningProgressProps> = ({
  steps,
  aiProviderLabel = 'AI',
  isActive,
  onDismiss,
}) => {
  if (!isActive && steps.length === 0) return null;

  const hasErrors = steps.some(s => s.status === 'error');
  const isComplete = !isActive && steps.length > 0;

  return (
    <div className="bg-slate-900 border border-indigo-800/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-950/60 border-b border-indigo-800/40">
        <div className="flex items-center gap-2.5">
          {isActive ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          ) : hasErrors ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-sm font-semibold text-white">
            {isActive
              ? `${aiProviderLabel} provisioning infrastructure…`
              : hasErrors
                ? 'Provisioning completed with errors'
                : `Infrastructure provisioned`}
          </span>
        </div>
        {isComplete && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="px-5 py-4 space-y-2.5">
        {steps.length === 0 && isActive && (
          <div className="flex items-center gap-2.5 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0" />
            Analysing backend features…
          </div>
        )}

        {steps.map(step => (
          <div key={step.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              <StatusIcon status={step.status} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ResourceIcon type={step.resource_type} />
                <span className={`text-xs font-semibold ${
                  step.status === 'error' ? 'text-red-400' :
                  step.status === 'skipped' ? 'text-slate-400' :
                  'text-white'
                }`}>
                  {step.resource_name}
                </span>
                <span className="text-xs text-slate-500">
                  {resourceLabel(step.resource_type)}
                  {step.status === 'skipped' && ' (already exists)'}
                  {step.status === 'error' && ' — failed'}
                </span>
              </div>
              {step.details?.error && (
                <p className="text-xs text-red-400 mt-0.5 font-mono truncate">
                  {step.details.error}
                </p>
              )}
            </div>
          </div>
        ))}

        {isActive && steps.length > 0 && (
          <div className="flex items-center gap-2.5 text-xs text-slate-500 pt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            Continuing…
          </div>
        )}
      </div>

      {/* Summary footer */}
      {isComplete && (
        <div className={`px-5 py-3 border-t text-xs flex items-center gap-2 ${
          hasErrors
            ? 'border-red-900/40 bg-red-950/30 text-red-400'
            : 'border-emerald-900/40 bg-emerald-950/20 text-emerald-400'
        }`}>
          {hasErrors ? (
            <><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Some resources failed — check logs and create them manually.</>
          ) : (
            <><CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> {steps.filter(s => s.status === 'created').length} resource{steps.filter(s => s.status === 'created').length !== 1 ? 's' : ''} provisioned successfully.</>
          )}
        </div>
      )}
    </div>
  );
};

export default ProvisioningProgress;
