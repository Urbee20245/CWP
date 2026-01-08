"use client";

import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Loader2, DollarSign, TrendingUp, TrendingDown, Users, Zap, Clock, FileText, BarChart3 } from 'lucide-react';
import { fetchBillingMetrics, RevenueMetrics } from '../utils/billingMetrics';

const AdminRevenueDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await fetchBillingMetrics();
        setMetrics(data);
      } catch (e) {
        console.error("Failed to load revenue metrics:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadMetrics();
  }, []);

  const formatCurrency = (amount: number) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (amount: number) => `${amount.toFixed(2)}%`;

  const statCards = metrics ? [
    { title: 'Monthly Recurring Revenue (MRR)', value: formatCurrency(metrics.mrr), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: metrics.newSubscriptions30Days > metrics.canceledSubscriptions30Days ? 'up' : 'down' },
    { title: 'Active Subscriptions', value: metrics.activeSubscriptions, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'stable' },
    { title: 'One-Time Revenue (30 Days)', value: formatCurrency(metrics.oneTimeRevenue30Days), icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'up' },
    { title: 'Churn Rate (30 Days)', value: formatPercent(metrics.churnRate), icon: TrendingDown, color: metrics.churnRate > 5 ? 'text-red-600' : 'text-emerald-600', bg: metrics.churnRate > 5 ? 'bg-red-50' : 'bg-emerald-50', trend: metrics.churnRate > 5 ? 'down' : 'up' },
  ] : [];

  const renderTrend = (trend: 'up' | 'down' | 'stable', color: string) => {
    if (trend === 'up') return <TrendingUp className={`w-4 h-4 ${color}`} />;
    if (trend === 'down') return <TrendingDown className={`w-4 h-4 ${color}`} />;
    return <Clock className={`w-4 h-4 text-slate-500`} />;
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-indigo-600" /> Revenue & Retention Dashboard
        </h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              {statCards.map((card, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">{card.title}</p>
                    <div className={`w-8 h-8 rounded-full ${card.bg} flex items-center justify-center ${card.color}`}>
                      <card.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{card.value}</p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                    {renderTrend(card.trend as 'up' | 'down' | 'stable', card.color)}
                    <span className={card.color}>
                        {card.trend === 'up' ? 'Positive Trend' : card.trend === 'down' ? 'Needs Attention' : 'Stable'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Subscription Metrics */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">
                    Subscription Activity (30 Days)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-xs text-emerald-600 uppercase font-semibold mb-1">New Subscriptions</p>
                        <p className="text-2xl font-bold text-slate-900">{metrics?.newSubscriptions30Days}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs text-red-600 uppercase font-semibold mb-1">Canceled Subscriptions</p>
                        <p className="text-2xl font-bold text-slate-900">{metrics?.canceledSubscriptions30Days}</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <p className="text-xs text-indigo-600 uppercase font-semibold mb-1">Total Clients</p>
                        <p className="text-2xl font-bold text-slate-900">{metrics?.activeSubscriptions}</p>
                    </div>
                </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminRevenueDashboard;