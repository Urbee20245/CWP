"use client";

import React, { useState, useEffect } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { User, Loader2, Save, AlertTriangle, CheckCircle2, Briefcase, Phone, MapPin, Lock } from 'lucide-react';
import { Profile } from '../types/auth';

interface ClientDetails {
    businessName: string;
    phone: string;
    address: string;
}

const ClientProfile: React.FC = () => {
  const { profile, isLoading, user } = useAuth();
  const [formData, setFormData] = useState({ fullName: '', email: '' });
  const [clientData, setClientData] = useState<ClientDetails>({ businessName: '', phone: '', address: '' });
  const [clientId, setClientId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isClientLoading, setIsClientLoading] = useState(true);
  
  // Password Change State
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fetchClientDetails = async () => {
    if (!profile) return;
    setIsClientLoading(true);

    // 1. Fetch Client Business Details
    const { data: clientRecord, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, phone, address')
        .eq('owner_profile_id', profile.id)
        .single();
        
    if (clientError && clientError.code !== 'PGRST116') {
        console.error('Error fetching client record:', clientError);
        setSaveError('Failed to load client business details.');
    } else if (clientRecord) {
        setClientId(clientRecord.id);
        setClientData({
            businessName: clientRecord.business_name || '',
            phone: clientRecord.phone || '',
            address: clientRecord.address || '',
        });
    }

    // 2. Set Profile Details
    setFormData({
        fullName: profile.full_name || '',
        email: profile.email || user?.email || '',
    });
    
    setIsClientLoading(false);
  };

  useEffect(() => {
    if (profile) {
      fetchClientDetails();
    }
  }, [profile]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientData({ ...clientData, [e.target.name]: e.target.value });
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !clientId) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1. Update the profiles table (Full Name)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: formData.fullName })
        .eq('id', profile.id);

      if (profileError) throw profileError;
      
      // 2. Update the clients table (Business Details)
      const { error: clientError } = await supabase
        .from('clients')
        .update({
            business_name: clientData.businessName,
            phone: clientData.phone,
            address: clientData.address,
        })
        .eq('id', clientId);
        
      if (clientError) throw clientError;

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
  
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        setPasswordError("You must be logged in to change your password.");
        return;
    }
    
    setIsPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    
    const { newPassword, confirmPassword } = passwordForm;
    
    if (newPassword.length < 6) {
        setPasswordError("Password must be at least 6 characters long.");
        setIsPasswordSaving(false);
        return;
    }
    
    if (newPassword !== confirmPassword) {
        setPasswordError("New password and confirmation do not match.");
        setIsPasswordSaving(false);
        return;
    }
    
    try {
        // Supabase update user requires the new password
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });
        
        if (error) throw error;
        
        setPasswordSuccess(true);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        
        setTimeout(() => setPasswordSuccess(false), 3000);
        
    } catch (e: any) {
        console.error('Password update error:', e);
        setPasswordError(e.message || 'Failed to update password. Please try logging out and back in.');
    } finally {
        setIsPasswordSaving(false);
    }
  };

  if (isLoading || isClientLoading) {
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
          <User className="w-7 h-7 text-indigo-600" /> My Profile & Business Details
        </h1>

        <div className="space-y-8">
          
          {/* Profile & Business Details Form */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">
              Update Information
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
              
              {/* User Profile Section */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> User Account</h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                          <input
                              type="text"
                              name="fullName"
                              value={formData.fullName}
                              onChange={handleProfileChange}
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
                              readOnly
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                              disabled={isSaving}
                          />
                      </div>
                  </div>
              </div>
              
              {/* Business Details Section */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Business Details</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Business Name</label>
                          <input
                              type="text"
                              name="businessName"
                              value={clientData.businessName}
                              onChange={handleClientChange}
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                              required
                              disabled={isSaving}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Phone className="w-4 h-4" /> Phone Number</label>
                          <input
                              type="tel"
                              name="phone"
                              value={clientData.phone}
                              onChange={handleClientChange}
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                              disabled={isSaving}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Business Address</label>
                          <input
                              type="text"
                              name="address"
                              value={clientData.address}
                              onChange={handleClientChange}
                              placeholder="Street, City, State, Zip"
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                              disabled={isSaving}
                          />
                      </div>
                  </div>
              </div>

              <button
                type="submit"
                disabled={isSaving || !clientId}
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
          
          {/* Password Change Form */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-600" /> Change Password
            </h2>
            
            {passwordError && (
              <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {passwordError}
              </div>
            )}
            
            {passwordSuccess && (
              <div className="p-3 mb-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Password updated successfully!
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">New Password *</label>
                    <input
                        type="password"
                        name="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Minimum 6 characters"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                        required
                        disabled={isPasswordSaving}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Confirm New Password *</label>
                    <input
                        type="password"
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                        required
                        disabled={isPasswordSaving}
                    />
                </div>
                
                <button
                    type="submit"
                    disabled={isPasswordSaving || !passwordForm.newPassword || !passwordForm.confirmPassword}
                    className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isPasswordSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Updating Password...
                        </>
                    ) : (
                        <>
                            <Lock className="w-5 h-5" />
                            Update Password
                        </>
                    )}
                </button>
            </form>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientProfile;