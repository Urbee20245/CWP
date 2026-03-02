"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import AdminLayout from '../components/AdminLayout';
import {
  Loader2, DollarSign, CreditCard, CheckCircle2, AlertCircle,
  Copy, Check, ExternalLink, CalendarDays, Users, FileText,
} from 'lucide-react';

interface ClientOption {
  id: string;
  business_name: string;
  billing_email: string | null;
}

interface PaymentPlanResult {
  setup_fee_invoice_url: string;
  subscription_id?: string;
  setup_fee_cents: number;
  monthly_cents: number;
  months: number;
  description: string;
}

const AdminPaymentPlan: React.FC = () => {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form state
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('Website Setup Fee');
  const [setupFeeDollars, setSetupFeeDollars] = useState('250');
  const [monthlyDollars, setMonthlyDollars] = useState('35');
  const [months, setMonths] = useState('2');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentPlanResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_name, billing_email')
        .eq('status', 'active')
        .order('business_name');
      if (!error && data) setClients(data);
      setLoadingClients(false);
    };
    fetchClients();
  }, []);

  const setupFeeCents = Math.round(parseFloat(setupFeeDollars || '0') * 100);
  const monthlyCents = Math.round(parseFloat(monthlyDollars || '0') * 100);
  const monthsNum = parseInt(months || '0', 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!clientId) { setError('Please select a client.'); return; }
    if (setupFeeCents <= 0) { setError('Setup fee must be greater than $0.'); return; }
    if (monthlyCents <= 0) { setError('Monthly amount must be greater than $0.'); return; }
    if (monthsNum < 1) { setError('Months must be at least 1.'); return; }
    if (!description.trim()) { setError('Please enter a description.'); return; }

    setIsSubmitting(true);
    try {
      const data = await AdminService.createPaymentPlan({
        client_id: clientId,
        setup_fee_cents: setupFeeCents,
        monthly_cents: monthlyCents,
        months: monthsNum,
        description: description.trim(),
      });
      setResult({
        setup_fee_invoice_url: data.setup_fee_invoice_url,
        subscription_id: data.subscription_id,
        setup_fee_cents: setupFeeCents,
        monthly_cents: monthlyCents,
        months: monthsNum,
        description: description.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create payment plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.setup_fee_invoice_url) return;
    await navigator.clipboard.writeText(result.setup_fee_invoice_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setClientId('');
    setDescription('Website Setup Fee');
    setSetupFeeDollars('250');
    setMonthlyDollars('35');
    setMonths('2');
  };

  const selectedClient = clients.find(c => c.id === clientId);

  const buildSchedule = (setupCents: number, moCents: number, mo: number) => {
    const rows = [
      { day: 'Today', label: 'Setup fee (immediate invoice)', amount: setupCents, type: 'invoice' as const },
    ];
    for (let i = 1; i <= mo; i++) {
      rows.push({
        day: `Day ${i * 30}`,
        label: `Month ${i} — recurring charge`,
        amount: moCents,
        type: 'recurring' as const,
      });
    }
    rows.push({
      day: `Day ${mo * 30 + 1}`,
      label: 'Subscription auto-cancels',
      amount: 0,
      type: 'cancel' as const,
    });
    return rows;
  };

  const fmtDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Plan Builder</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create a custom setup-fee + recurring billing plan for any client. The setup fee is charged today; monthly charges begin 30 days out and auto-cancel after the selected number of months.
          </p>
        </div>

        {!result ? (
          /* ─── Form ─── */
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Client selector */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 flex items-center gap-2.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">Select Client</h2>
              </div>
              <div className="bg-white p-5">
                {loadingClients ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading clients…
                  </div>
                ) : (
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">— Choose a client —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}{c.billing_email ? ` (${c.billing_email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedClient && (
                  <p className="mt-2 text-xs text-slate-400">
                    Client ID: <span className="font-mono text-slate-600">{selectedClient.id}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Plan details */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">Plan Details</h2>
              </div>
              <div className="bg-white p-5 space-y-4">

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Invoice Description</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Website Setup Fee - Acme Corp"
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Setup fee */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Setup Fee</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        value={setupFeeDollars}
                        onChange={e => setSetupFeeDollars(e.target.value)}
                        placeholder="250"
                        min="1"
                        step="0.01"
                        className="w-full pl-7 pr-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Charged today</p>
                  </div>

                  {/* Monthly */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Monthly</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        value={monthlyDollars}
                        onChange={e => setMonthlyDollars(e.target.value)}
                        placeholder="35"
                        min="1"
                        step="0.01"
                        className="w-full pl-7 pr-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Per billing cycle</p>
                  </div>

                  {/* Months */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Months</label>
                    <input
                      type="number"
                      value={months}
                      onChange={e => setMonths(e.target.value)}
                      placeholder="2"
                      min="1"
                      max="24"
                      step="1"
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                      required
                      disabled={isSubmitting}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Then auto-cancel</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview schedule */}
            {setupFeeCents > 0 && monthlyCents > 0 && monthsNum > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 flex items-center gap-2.5">
                  <CalendarDays className="w-4 h-4 text-violet-400" />
                  <h2 className="text-xs font-bold text-white tracking-widest uppercase">Schedule Preview</h2>
                </div>
                <div className="bg-white divide-y divide-slate-100">
                  {buildSchedule(setupFeeCents, monthlyCents, monthsNum).map((row, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-3">{row.day}</span>
                        <span className="text-sm text-slate-700">{row.label}</span>
                      </div>
                      {row.type !== 'cancel' ? (
                        <span className={`text-sm font-bold ${row.type === 'invoice' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          {fmtDollars(row.amount)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Done</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !clientId || setupFeeCents <= 0 || monthlyCents <= 0 || monthsNum < 1}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Payment Plan…</>
                : <><CreditCard className="w-4 h-4" /> Create Payment Plan</>
              }
            </button>
          </form>
        ) : (
          /* ─── Success ─── */
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Payment plan created!</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {selectedClient?.business_name ?? 'Client'} — {result.description}
                </p>
              </div>
            </div>

            {/* Invoice link */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">Setup Fee Invoice — Send to Client</h2>
              </div>
              <div className="bg-white p-5 space-y-3">
                <p className="text-xs text-slate-500">
                  Share this link with the client to collect the <strong className="text-slate-700">{fmtDollars(result.setup_fee_cents)}</strong> setup fee today.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={result.setup_fee_invoice_url}
                    className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 font-mono text-slate-600 truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex-shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a
                    href={result.setup_fee_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
                  </a>
                </div>
              </div>
            </div>

            {/* Schedule summary */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-violet-400" />
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">Payment Schedule</h2>
              </div>
              <div className="bg-white divide-y divide-slate-100">
                {buildSchedule(result.setup_fee_cents, result.monthly_cents, result.months).map((row, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.type === 'invoice' ? 'bg-emerald-500' : row.type === 'recurring' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                        <p className="text-xs text-slate-400">{row.day}</p>
                      </div>
                    </div>
                    {row.type !== 'cancel' ? (
                      <span className={`text-sm font-bold ${row.type === 'invoice' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {fmtDollars(row.amount)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Auto-cancelled</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Create Another Plan
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPaymentPlan;
