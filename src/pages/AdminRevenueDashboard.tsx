"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  Loader2,
  DollarSign,
  TrendingUp,
  BarChart3,
  Users,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Bell,
  BellOff,
  CheckCircle,
} from 'lucide-react';
import {
  fetchBillingMetrics,
  RevenueMetrics,
  SubscriptionRow,
  InvoiceRow,
} from '../utils/billingMetrics';
import { supabase } from '../integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reminder {
  id: string;
  client_id: string;
  note: string;
  reminder_date: string;
  is_completed: boolean;
  profiles: { full_name: string } | null;
  clients: { business_name: string } | null;
}

interface OpenInvoiceReminder {
  id: string;
  amount_due: number;
  status: string;
  hosted_invoice_url: string | null;
  due_date: string | null;
  last_reminder_sent_at: string | null;
  disable_reminders: boolean;
  label: string | null;
  clients: { business_name: string; billing_email: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const daysFromNow = (iso: string | null | undefined): number => {
  if (!iso) return Infinity;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const getClientName = (clients: SubscriptionRow['clients'] | InvoiceRow['clients']): string => {
  if (!clients) return 'Unknown Client';
  return clients.business_name ?? 'Unknown Client';
};

const getMonthlyAmountCents = (sub: SubscriptionRow): number | null =>
  sub.monthly_amount_cents ?? null;

// ─── Status Badges ────────────────────────────────────────────────────────────

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  open: 'bg-amber-100 text-amber-800',
  draft: 'bg-slate-100 text-slate-600',
  void: 'bg-red-100 text-red-700',
};

const SUB_STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  trialing: 'bg-indigo-100 text-indigo-800',
  incomplete: 'bg-amber-100 text-amber-800',
  incomplete_expired: 'bg-amber-100 text-amber-800',
  past_due: 'bg-amber-100 text-amber-800',
  canceled: 'bg-red-100 text-red-700',
  unpaid: 'bg-red-100 text-red-700',
};

const InvoiceStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
      INVOICE_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'
    }`}
  >
    {status}
  </span>
);

const SubStatusBadge: React.FC<{ sub: SubscriptionRow }> = ({ sub }) => {
  const label =
    sub.status === 'trialing'
      ? `Trial — charges ${formatDate(sub.current_period_end)}`
      : sub.status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
        SUB_STATUS_STYLES[sub.status] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, iconBg, iconColor }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
    </div>
    <p className="text-3xl font-bold text-slate-900">{value}</p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = 'revenue' | 'reminders';

const AdminRevenueDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('revenue');
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const [metricsData, { data: remindersData }, { data: invoicesData }] = await Promise.all([
        fetchBillingMetrics(),
        supabase
          .from('client_reminders')
          .select('id, client_id, note, reminder_date, is_completed, profiles(full_name), clients(business_name)')
          .order('reminder_date', { ascending: true }),
        supabase
          .from('invoices')
          .select('id, amount_due, status, hosted_invoice_url, due_date, last_reminder_sent_at, disable_reminders, label, clients(business_name, billing_email)')
          .eq('status', 'open'),
      ]);
      setMetrics(metricsData);
      setReminders((remindersData ?? []) as unknown as Reminder[]);
      setOpenInvoices((invoicesData ?? []) as unknown as OpenInvoiceReminder[]);
    } catch (e) {
      console.error('Failed to load revenue data:', e);
      setError('Failed to load revenue data. Please refresh and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => load(true);

  const markComplete = async (id: string) => {
    await supabase.from('client_reminders').update({ is_completed: true }).eq('id', id);
    await load(true);
  };

  const toggleReminders = async (id: string, currentValue: boolean) => {
    await supabase.from('invoices').update({ disable_reminders: !currentValue }).eq('id', id);
    await load(true);
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            Revenue &amp; Billing Operations
          </h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {([
            { id: 'revenue', label: 'Revenue' },
            { id: 'reminders', label: 'Reminders & Activity' },
          ] as { id: TabId; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        ) : metrics ? (
          <>
            {/* ── Revenue Tab ── */}
            {activeTab === 'revenue' && (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-10">
                  <StatCard
                    title="Total Revenue Collected"
                    value={formatCurrency(metrics.totalRevenuePaid)}
                    icon={DollarSign}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                  />
                  <StatCard
                    title="MRR (incl. Trialing)"
                    value={formatCurrency(metrics.mrr)}
                    icon={TrendingUp}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                  />
                  <StatCard
                    title="Outstanding / Unpaid"
                    value={formatCurrency(metrics.totalRevenueOutstanding)}
                    icon={AlertTriangle}
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                  />
                  <StatCard
                    title="Collected (Last 30 Days)"
                    value={formatCurrency(metrics.revenueCollected30Days)}
                    icon={BarChart3}
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                  />
                  <StatCard
                    title="Active Subscriptions"
                    value={metrics.activeSubscriptions + metrics.trialingSubscriptions}
                    icon={Users}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                  />
                </div>

                {/* All Invoices */}
                <SectionCard title="All Invoices" subtitle="Last 50 invoices — all statuses">
                  {metrics.recentInvoices.length === 0 ? (
                    <EmptyState message="No invoices found." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <Th>Client</Th>
                            <Th>Description</Th>
                            <Th>Amount</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                            <Th>Action</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {metrics.recentInvoices.map(inv => (
                            <InvoiceTableRow key={inv.id} invoice={inv} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Active Subscriptions */}
                <SectionCard title="Active Subscriptions" subtitle="All subscription records">
                  {metrics.allSubscriptions.length === 0 ? (
                    <EmptyState message="No subscriptions found." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <Th>Client</Th>
                            <Th>Plan</Th>
                            <Th>Monthly Amount</Th>
                            <Th>Status</Th>
                            <Th>Next Charge</Th>
                            <Th>Auto-Cancels</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {metrics.allSubscriptions.map(sub => (
                            <SubscriptionTableRow key={sub.id} sub={sub} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* Upcoming Payments */}
                <SectionCard title="Upcoming Payments" subtitle="Active &amp; trialing — next 60 days">
                  {metrics.upcomingPayments.length === 0 ? (
                    <EmptyState message="No upcoming payments in the next 60 days." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <Th>Client</Th>
                            <Th>Plan</Th>
                            <Th>Amount</Th>
                            <Th>Charge Date</Th>
                            <Th>Days Away</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {metrics.upcomingPayments.map(sub => (
                            <UpcomingPaymentRow key={sub.id} sub={sub} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ── Reminders & Activity Tab ── */}
            {activeTab === 'reminders' && (
              <>
                {/* Section 1: Subscription Activity (30 Days) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                  <StatCard
                    title="New Subscriptions (30 Days)"
                    value={metrics.newSubscriptions30Days}
                    icon={TrendingUp}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                  />
                  <StatCard
                    title="Canceled Subscriptions (30 Days)"
                    value={metrics.canceledSubscriptions30Days}
                    icon={Users}
                    iconBg="bg-red-50"
                    iconColor="text-red-600"
                  />
                  <StatCard
                    title="Pending / Awaiting Payment"
                    value={metrics.pendingSubscriptions}
                    icon={AlertTriangle}
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                  />
                  <StatCard
                    title="Churn Rate"
                    value={`${metrics.churnRate}%`}
                    icon={BarChart3}
                    iconBg={metrics.churnRate > 5 ? 'bg-red-50' : 'bg-emerald-50'}
                    iconColor={metrics.churnRate > 5 ? 'text-red-600' : 'text-emerald-600'}
                  />
                </div>

                {metrics.pendingSubscriptions > 0 && (
                  <div className="mb-8 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    {metrics.pendingSubscriptions} subscription{metrics.pendingSubscriptions > 1 ? 's are' : ' is'} awaiting payment or confirmation.
                  </div>
                )}

                {/* Section 2: Client Reminders */}
                <SectionCard title="Client Reminders" subtitle="Upcoming and completed reminders">
                  {reminders.length === 0 ? (
                    <EmptyState message="No reminders set." />
                  ) : (
                    <div className="space-y-3">
                      {reminders.map(reminder => (
                        <div
                          key={reminder.id}
                          className={`flex items-start justify-between gap-4 p-4 rounded-xl border ${
                            reminder.is_completed
                              ? 'border-emerald-200 bg-emerald-50 opacity-60'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium text-slate-800 ${reminder.is_completed ? 'line-through' : ''}`}>
                              {reminder.note}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              {reminder.clients?.business_name && (
                                <span className="text-xs text-slate-500">
                                  Client: <span className="font-medium">{reminder.clients.business_name}</span>
                                </span>
                              )}
                              {reminder.profiles?.full_name && (
                                <span className="text-xs text-slate-500">
                                  Set by: <span className="font-medium">{reminder.profiles.full_name}</span>
                                </span>
                              )}
                              <span className="text-xs text-slate-500">
                                Due: <span className="font-medium">{formatDate(reminder.reminder_date)}</span>
                              </span>
                            </div>
                          </div>
                          {!reminder.is_completed && (
                            <button
                              onClick={() => markComplete(reminder.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Mark Complete
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Section 3: Invoice Reminders Status */}
                <SectionCard title="Invoice Reminders Status" subtitle="Open invoices — reminder settings">
                  {openInvoices.length === 0 ? (
                    <EmptyState message="No open invoices." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <Th>Client</Th>
                            <Th>Invoice</Th>
                            <Th>Amount</Th>
                            <Th>Due Date</Th>
                            <Th>Last Reminder Sent</Th>
                            <Th>Reminders</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {openInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <Td>
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {inv.clients?.business_name ?? 'Unknown Client'}
                                  </span>
                                  {inv.clients?.billing_email && (
                                    <p className="text-xs text-slate-400">{inv.clients.billing_email}</p>
                                  )}
                                </div>
                              </Td>
                              <Td>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600">{inv.label ?? '—'}</span>
                                  {inv.hosted_invoice_url && (
                                    <a
                                      href={inv.hosted_invoice_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                                    >
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </Td>
                              <Td>
                                <span className="font-semibold text-slate-800">
                                  {formatCurrency(inv.amount_due / 100)}
                                </span>
                              </Td>
                              <Td>{formatDate(inv.due_date)}</Td>
                              <Td>
                                <span className={inv.last_reminder_sent_at ? 'text-slate-700' : 'text-slate-400'}>
                                  {inv.last_reminder_sent_at ? formatDate(inv.last_reminder_sent_at) : 'Never'}
                                </span>
                              </Td>
                              <Td>
                                <button
                                  onClick={() => toggleReminders(inv.id, inv.disable_reminders)}
                                  title={inv.disable_reminders ? 'Reminders disabled — click to enable' : 'Reminders enabled — click to disable'}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                                  style={inv.disable_reminders
                                    ? { borderColor: '#fca5a5', color: '#dc2626', background: 'rgba(239,68,68,0.06)' }
                                    : { borderColor: '#6ee7b7', color: '#059669', background: 'rgba(16,185,129,0.06)' }
                                  }
                                >
                                  {inv.disable_reminders
                                    ? <><BellOff className="w-3.5 h-3.5" /> Disabled</>
                                    : <><Bell className="w-3.5 h-3.5" /> Enabled</>
                                  }
                                </button>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="bg-white rounded-xl shadow-lg border border-slate-100 mb-8">
    <div className="px-6 py-5 border-b border-slate-100">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <td className={`py-3 px-3 text-slate-700 ${className}`}>{children}</td>;

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-sm text-slate-400 text-center py-6">{message}</p>
);

const InvoiceTableRow: React.FC<{ invoice: InvoiceRow }> = ({ invoice }) => (
  <tr className="hover:bg-slate-50 transition-colors">
    <Td>
      <span className="font-medium text-slate-900">{getClientName(invoice.clients)}</span>
    </Td>
    <Td>
      <span className="text-slate-500">{invoice.label ?? '—'}</span>
    </Td>
    <Td>
      <span className="font-semibold text-slate-800">{formatCurrency(invoice.amount_due / 100)}</span>
    </Td>
    <Td>
      <InvoiceStatusBadge status={invoice.status} />
    </Td>
    <Td>{formatDate(invoice.created_at)}</Td>
    <Td>
      {invoice.hosted_invoice_url ? (
        <a
          href={invoice.hosted_invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-xs"
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-slate-400 text-xs">—</span>
      )}
    </Td>
  </tr>
);

const SubscriptionTableRow: React.FC<{ sub: SubscriptionRow }> = ({ sub }) => {
  const amountCents = getMonthlyAmountCents(sub);
  const cancelDisplay = sub.cancel_at
    ? formatDate(sub.cancel_at)
    : sub.cancel_at_period_end
    ? `${formatDate(sub.current_period_end)} (period end)`
    : 'Ongoing';

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <Td>
        <div>
          <span className="font-medium text-slate-900">{getClientName(sub.clients)}</span>
          {sub.clients?.billing_email && (
            <p className="text-xs text-slate-400">{sub.clients.billing_email}</p>
          )}
        </div>
      </Td>
      <Td>
        <span className="text-slate-700">{sub.plan_label ?? sub.stripe_price_id}</span>
      </Td>
      <Td>
        {amountCents != null ? (
          <span className="font-semibold text-slate-800">{formatCurrency(amountCents / 100)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </Td>
      <Td>
        <SubStatusBadge sub={sub} />
      </Td>
      <Td>{sub.status === 'trialing' ? '—' : formatDate(sub.current_period_end)}</Td>
      <Td>
        <span
          className={
            cancelDisplay === 'Ongoing' ? 'text-slate-400 text-xs' : 'text-amber-700 text-xs font-medium'
          }
        >
          {cancelDisplay}
        </span>
      </Td>
    </tr>
  );
};

const UpcomingPaymentRow: React.FC<{ sub: SubscriptionRow }> = ({ sub }) => {
  const days = daysFromNow(sub.current_period_end);
  const isUrgent = days <= 7;
  const amountCents = getMonthlyAmountCents(sub);

  return (
    <tr className={`transition-colors ${isUrgent ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
      <Td>
        <span className="font-medium text-slate-900">{getClientName(sub.clients)}</span>
      </Td>
      <Td>
        <span className="text-slate-700">{sub.plan_label ?? sub.stripe_price_id}</span>
      </Td>
      <Td>
        {amountCents != null ? (
          <span className="font-semibold text-slate-800">{formatCurrency(amountCents / 100)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </Td>
      <Td>{formatDate(sub.current_period_end)}</Td>
      <Td>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isUrgent
              ? 'bg-amber-200 text-amber-900'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
        </span>
      </Td>
    </tr>
  );
};

export default AdminRevenueDashboard;
