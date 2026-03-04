"use client";

import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  Loader2, DollarSign, TrendingUp, TrendingDown, Zap,
  BarChart3, AlertTriangle, Calendar, ExternalLink, Clock, RefreshCw
} from 'lucide-react';
import { fetchBillingMetrics, RevenueMetrics, SubscriptionRow, InvoiceRow } from '../utils/billingMetrics';

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const clientName = (row: SubscriptionRow | InvoiceRow) => {
  const c = row.clients as any;
  if (!c) return '—';
  if (typeof c === 'object' && !Array.isArray(c)) return c.business_name ?? '—';
  if (Array.isArray(c) && c.length > 0) return c[0].business_name ?? '—';
  return '—';
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    paid:      'bg-emerald-100 text-emerald-700',
    active:    'bg-emerald-100 text-emerald-700',
    open:      'bg-amber-100 text-amber-700',
    trialing:  'bg-indigo-100 text-indigo-700',
    incomplete:'bg-amber-100 text-amber-700',
    past_due:  'bg-red-100 text-red-700',
    canceled:  'bg-red-100 text-red-700',
    void:      'bg-slate-100 text-slate-500',
    draft:     'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const AdminRevenueDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBillingMetrics();
      setMetrics(data);
    } catch (e: any) {
      console.error('Revenue dashboard error:', e);
      setError(e?.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statCards = metrics ? [
    {
      title: 'Total Collected',
      sub: 'All time',
      value: fmt(metrics.totalRevenuePaid),
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      title: 'MRR',
      sub: `${metrics.activeSubscriptions} active · ${metrics.trialingSubscriptions} trialing`,
      value: fmt(metrics.mrr),
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
    },
    {
      title: 'Outstanding',
      sub: 'Unpaid open invoices',
      value: fmt(metrics.totalRevenueOutstanding),
      icon: AlertTriangle,
      color: metrics.totalRevenueOutstanding > 0 ? 'text-amber-600' : 'text-slate-400',
      bg: metrics.totalRevenueOutstanding > 0 ? 'bg-amber-50' : 'bg-slate-50',
      border: metrics.totalRevenueOutstanding > 0 ? 'border-amber-200' : 'border-slate-200',
    },
    {
      title: 'Collected (30 days)',
      sub: 'Paid invoices this month',
      value: fmt(metrics.revenueCollected30Days),
      icon: Calendar,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
    {
      title: 'Active Subscriptions',
      sub: metrics.pendingSubscriptions > 0 ? `${metrics.pendingSubscriptions} pending payment` : 'All current',
      value: metrics.activeSubscriptions + metrics.trialingSubscriptions,
      icon: Zap,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
  ] : [];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            Revenue &amp; Billing Operations
          </h1>
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Failed to load revenue data</p>
              <p className="text-sm mt-1 font-mono">{error}</p>
              <button onClick={load} className="mt-3 text-sm underline">Try again</button>
            </div>
          </div>
        )}

        {!isLoading && !error && metrics && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
              {statCards.map((card, i) => (
                <div key={i} className={`bg-white rounded-xl shadow-sm border ${card.border} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{card.title}</p>
                    <div className={`w-8 h-8 rounded-full ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold text-slate-900`}>{card.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Upcoming Payments */}
            {metrics.upcomingPayments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-base font-bold text-slate-900">Upcoming Payments <span className="text-slate-400 font-normal text-sm">(next 60 days)</span></h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-6 py-3 text-left font-semibold">Client</th>
                        <th className="px-6 py-3 text-left font-semibold">Plan</th>
                        <th className="px-6 py-3 text-right font-semibold">Amount</th>
                        <th className="px-6 py-3 text-left font-semibold">Charge Date</th>
                        <th className="px-6 py-3 text-left font-semibold">Days Away</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metrics.upcomingPayments.map(sub => {
                        const days = daysUntil(sub.current_period_end);
                        const urgent = days !== null && days <= 7;
                        const amtCents = sub.monthly_amount_cents ?? 0;
                        return (
                          <tr key={sub.id} className={urgent ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                            <td className="px-6 py-3 font-medium text-slate-800">{clientName(sub)}</td>
                            <td className="px-6 py-3 text-slate-500 max-w-xs truncate">{sub.plan_label ?? sub.stripe_price_id}</td>
                            <td className="px-6 py-3 text-right font-semibold text-slate-800">{fmt(amtCents / 100)}</td>
                            <td className="px-6 py-3 text-slate-600">{fmtDate(sub.current_period_end)}</td>
                            <td className="px-6 py-3">
                              {days !== null && (
                                <span className={`font-semibold ${urgent ? 'text-amber-600' : 'text-slate-500'}`}>
                                  {days === 0 ? 'Today' : `${days}d`}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All Invoices */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">All Invoices</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-6 py-3 text-left font-semibold">Client</th>
                      <th className="px-6 py-3 text-left font-semibold">Description</th>
                      <th className="px-6 py-3 text-right font-semibold">Amount</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                      <th className="px-6 py-3 text-left font-semibold">Date</th>
                      <th className="px-6 py-3 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.recentInvoices.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No invoices found</td>
                      </tr>
                    )}
                    {metrics.recentInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-800">{clientName(inv)}</td>
                        <td className="px-6 py-3 text-slate-500 max-w-xs truncate">{inv.label ?? inv.invoice_type ?? 'Invoice'}</td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-800">{fmt((inv.amount_due || 0) / 100)}</td>
                        <td className="px-6 py-3"><StatusBadge status={inv.status} /></td>
                        <td className="px-6 py-3 text-slate-500">{fmtDate(inv.created_at)}</td>
                        <td className="px-6 py-3">
                          {inv.hosted_invoice_url ? (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Subscriptions */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">All Subscriptions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-6 py-3 text-left font-semibold">Client</th>
                      <th className="px-6 py-3 text-left font-semibold">Plan</th>
                      <th className="px-6 py-3 text-right font-semibold">Monthly</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                      <th className="px-6 py-3 text-left font-semibold">Next Charge</th>
                      <th className="px-6 py-3 text-left font-semibold">Auto-Cancels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.allSubscriptions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No subscriptions found</td>
                      </tr>
                    )}
                    {metrics.allSubscriptions.map(sub => {
                      const amtCents = sub.monthly_amount_cents ?? 0;
                      const c = sub.clients as any;
                      const email = c?.billing_email ?? null;
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3">
                            <p className="font-medium text-slate-800">{clientName(sub)}</p>
                            {email && <p className="text-xs text-slate-400">{email}</p>}
                          </td>
                          <td className="px-6 py-3 text-slate-500 max-w-xs truncate">{sub.plan_label ?? sub.stripe_price_id}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-800">
                            {amtCents > 0 ? fmt(amtCents / 100) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-3">
                            <StatusBadge status={sub.status} />
                            {sub.status === 'trialing' && sub.current_period_end && (
                              <p className="text-xs text-indigo-500 mt-0.5">First charge {fmtDate(sub.current_period_end)}</p>
                            )}
                          </td>
                          <td className="px-6 py-3 text-slate-500">
                            {sub.status === 'trialing'
                              ? <span className="text-indigo-500">{fmtDate(sub.current_period_end)}</span>
                              : fmtDate(sub.current_period_end)
                            }
                          </td>
                          <td className="px-6 py-3 text-slate-500">
                            {sub.cancel_at_period_end
                              ? <span className="text-amber-600 text-xs font-medium">At period end</span>
                              : <span className="text-slate-400 text-xs">Ongoing</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminRevenueDashboard;
