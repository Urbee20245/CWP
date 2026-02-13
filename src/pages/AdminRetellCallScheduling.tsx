"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import { supabase } from '../integrations/supabase/client';
import {
  Phone, Calendar, User, Clock, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Plus, RefreshCw, Search, Edit, Play
} from 'lucide-react';

interface Client {
  id: string;
  business_name: string;
  phone: string;
  retell_agent_id: string;
  phone_number: string | null;
  voice_status: string;
}

interface ScheduledCall {
  id: string;
  client_id: string;
  prospect_name: string;
  prospect_phone: string;
  scheduled_time: string;
  retell_agent_id: string;
  from_phone_number: string;
  status: string;
  retell_call_id: string | null;
  call_duration_seconds: number | null;
  error_message: string | null;
  admin_notes: string | null;
  created_at: string;
  clients?: {
    business_name: string;
  };
  profiles?: {
    full_name: string;
    email: string;
  };
}

const AdminRetellCallScheduling: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [triggerMode, setTriggerMode] = useState<'immediate' | 'scheduled'>('scheduled');

  const showFeedback = (type: 'success' | 'error' | 'info', text: string, durationMs = 8000) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), durationMs);
  };

  const fetchClients = useCallback(async () => {
    try {
      const clientsData = await AdminService.getVoiceClients();

      // Only show clients with active voice integration
      const activeClients = clientsData.filter((c: any) => {
        const voiceData = Array.isArray(c.client_voice_integrations)
          ? c.client_voice_integrations[0]
          : c.client_voice_integrations;

        return voiceData?.voice_status === 'active' && voiceData?.retell_agent_id;
      });

      setClients(activeClients.map((c: any) => {
        const voiceData = Array.isArray(c.client_voice_integrations)
          ? c.client_voice_integrations[0]
          : c.client_voice_integrations;

        return {
          id: c.id,
          business_name: c.business_name || 'Unknown',
          phone: c.phone || '',
          retell_agent_id: voiceData?.retell_agent_id || '',
          phone_number: voiceData?.phone_number || null,
          voice_status: voiceData?.voice_status || 'inactive',
        };
      }));
    } catch (error: any) {
      console.error('Failed to fetch clients:', error);
      showFeedback('error', 'Failed to fetch clients: ' + error.message);
    }
  }, []);

  const fetchScheduledCalls = useCallback(async () => {
    try {
      const filters: any = {};
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }

      const calls = await AdminService.getScheduledCalls(filters);
      setScheduledCalls(calls || []);
    } catch (error: any) {
      console.error('Failed to fetch scheduled calls:', error);
      showFeedback('error', 'Failed to fetch scheduled calls: ' + error.message);
    }
  }, [filterStatus]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchClients(), fetchScheduledCalls()]);
    setIsLoading(false);
  }, [fetchClients, fetchScheduledCalls]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      showFeedback('error', 'Please select a client');
      return;
    }
    if (!prospectName.trim()) {
      showFeedback('error', 'Please enter the prospect name');
      return;
    }
    if (!prospectPhone.trim()) {
      showFeedback('error', 'Please enter the prospect phone number');
      return;
    }
    if (triggerMode === 'scheduled' && !scheduledTime) {
      showFeedback('error', 'Please select a scheduled time');
      return;
    }

    // Validate phone number format (basic)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = prospectPhone.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      showFeedback('error', 'Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (!selectedClient) {
        throw new Error('Selected client not found');
      }

      const params = {
        client_id: selectedClientId,
        prospect_name: prospectName.trim(),
        prospect_phone: cleanPhone,
        retell_agent_id: selectedClient.retell_agent_id,
        from_phone_number: selectedClient.phone_number || undefined,
        scheduled_time: triggerMode === 'scheduled' ? new Date(scheduledTime).toISOString() : undefined,
        trigger_immediately: triggerMode === 'immediate',
        admin_notes: adminNotes.trim() || undefined,
      };

      const result = await AdminService.triggerRetellCall(params);

      if (result.success) {
        if (triggerMode === 'immediate') {
          showFeedback('success', `Call initiated successfully to ${prospectName}!`);
        } else {
          showFeedback('success', `Call scheduled successfully for ${new Date(scheduledTime).toLocaleString()}!`);
        }

        // Reset form
        setShowForm(false);
        setSelectedClientId('');
        setProspectName('');
        setProspectPhone('');
        setScheduledTime('');
        setAdminNotes('');
        setTriggerMode('scheduled');

        // Refresh the list
        await fetchScheduledCalls();
      }
    } catch (error: any) {
      console.error('Failed to trigger call:', error);
      showFeedback('error', 'Failed to trigger call: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCall = async (callId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled call?')) {
      return;
    }

    try {
      await AdminService.cancelScheduledCall(callId);
      showFeedback('success', 'Call cancelled successfully');
      await fetchScheduledCalls();
    } catch (error: any) {
      showFeedback('error', 'Failed to cancel call: ' + error.message);
    }
  };

  const handleForceCall = async (callId: string) => {
    if (!confirm('Are you sure you want to trigger this call immediately?')) {
      return;
    }

    try {
      const result = await AdminService.forceScheduledCall(callId);
      if (result.success) {
        showFeedback('success', 'Call triggered successfully!');
        await fetchScheduledCalls();
      }
    } catch (error: any) {
      showFeedback('error', 'Failed to trigger call: ' + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      scheduled: { icon: Calendar, color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
      calling: { icon: Phone, color: 'bg-purple-100 text-purple-800', label: 'Calling' },
      completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Completed' },
      failed: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Failed' },
      cancelled: { icon: AlertTriangle, color: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const filteredCalls = scheduledCalls.filter(call => {
    const matchesSearch = searchQuery === '' ||
      call.prospect_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.prospect_phone.includes(searchQuery) ||
      call.clients?.business_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Get default datetime (30 minutes from now)
  const getDefaultScheduledTime = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 30);
    return date.toISOString().slice(0, 16);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Retell Call Scheduling">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Retell Call Scheduling">
      <div className="space-y-6">
        {/* Feedback Message */}
        {feedbackMessage && (
          <div className={`p-4 rounded-lg ${
            feedbackMessage.type === 'success' ? 'bg-green-50 text-green-800' :
            feedbackMessage.type === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            {feedbackMessage.text}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retell Call Scheduling</h1>
            <p className="mt-1 text-sm text-gray-600">
              Schedule or trigger immediate AI calls to prospects
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Call
            </button>
          </div>
        </div>

        {/* Schedule Call Form */}
        {showForm && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule New Call</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.business_name} ({client.phone_number || 'No phone'})
                      </option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="mt-1 text-sm text-red-600">
                      No clients with active voice integration found. Please provision voice first.
                    </p>
                  )}
                </div>

                {/* Trigger Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Call Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={triggerMode}
                    onChange={(e) => setTriggerMode(e.target.value as 'immediate' | 'scheduled')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="scheduled">Schedule for Later</option>
                    <option value="immediate">Call Immediately</option>
                  </select>
                </div>

                {/* Prospect Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prospect Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                {/* Prospect Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prospect Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={prospectPhone}
                    onChange={(e) => setProspectPhone(e.target.value)}
                    placeholder="+12345678900"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Include country code (e.g., +1 for US)</p>
                </div>

                {/* Scheduled Time (only if mode is scheduled) */}
                {triggerMode === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scheduled Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledTime || getDefaultScheduledTime()}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                )}

                {/* Admin Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal notes about this call..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || clients.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 mr-2" />
                      {triggerMode === 'immediate' ? 'Call Now' : 'Schedule Call'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by prospect name, phone, or client..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="calling">Calling</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scheduled Calls List */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prospect
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      No scheduled calls found. Click "Schedule Call" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {call.prospect_name}
                            </div>
                            <div className="text-sm text-gray-500">{call.prospect_phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {call.clients?.business_name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(call.scheduled_time).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(call.status)}
                        {call.error_message && (
                          <div className="text-xs text-red-600 mt-1" title={call.error_message}>
                            Error: {call.error_message.substring(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {call.call_duration_seconds
                            ? `${Math.floor(call.call_duration_seconds / 60)}m ${call.call_duration_seconds % 60}s`
                            : '-'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {call.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleForceCall(call.id)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Trigger call now"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCancelCall(call.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Cancel call"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {call.retell_call_id && (
                            <span className="text-xs text-gray-500" title={call.retell_call_id}>
                              Call ID: {call.retell_call_id.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {scheduledCalls.filter(c => c.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Calling</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {scheduledCalls.filter(c => c.status === 'calling').length}
                </p>
              </div>
              <Phone className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-green-600">
                  {scheduledCalls.filter(c => c.status === 'completed').length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-semibold text-red-600">
                  {scheduledCalls.filter(c => c.status === 'failed').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRetellCallScheduling;
