"use client";

import React, { useState, useEffect } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { User, Loader2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Profile } from '../types/auth';

const ClientProfile: React.FC = () => {
  const { profile, isLoading, user } = useAuth();
  const [formData, setFormData] = useState({ fullName: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || user?.email || '',
      });
    }
  }, [profile, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1. Update the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: formData.fullName })
        .eq('id', profile.id);

      if (profileError) throw profileError;
      
      // Note: Email update requires a separate flow via supabase.auth.updateUser, 
      // which sends a confirmation email. We will skip that for simplicity here 
      // and only allow updating the full name via the profile table.

      setSaveSuccess(true);
      // A full page refresh or re-fetch in SessionProvider will update the context
      setTimeout(() => {
        setSaveSuccess(false);
        window.location.reload(); // Force reload to update context/layout
      }, 1500);

    } catch (e: any) {
      console.error('Profile update error:', e);
      setSaveError(e.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <User className="w-7 h-7 text-indigo-600" /> My Profile
        </h1>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
          <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">
            Personal Details
          </h2>

          {saveError && (
            <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {saveError}
            </div>
          )}
          
          {saveSuccess && (
            <div className="p-3 mb-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Profile updated successfully! Reloading...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email Address (Login)</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                // Email is read-only here, as changing it requires a separate Supabase Auth flow
                readOnly
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                disabled={isSaving}
              />
              <p className="text-xs text-slate-500 mt-2">
                To change your email address, please contact support.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientProfile;