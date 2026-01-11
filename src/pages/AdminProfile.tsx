"use client";

import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { User, Loader2, Save, AlertTriangle, CheckCircle2, Lock, Mail } from 'lucide-react';
import { Profile } from '../types/auth';

const AdminProfile: React.FC = () => {
  const { profile, user, isLoading: isAuthLoading } = useAuth();
  const [formData, setFormData] = useState({ fullName: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Password Change State
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || user?.email || '',
      });
    }
  }, [profile, user]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

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
      
      // 2. Update Auth Email (if changed)
      if (formData.email !== profile.email) {
          const { error: emailError } = await supabase.auth.updateUser({
              email: formData.email,
          });
          if (emailError) throw emailError;
          alert("Email update requires confirmation. Please check your new email address for a verification link.");
      }

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

  if (isAuthLoading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <User className="w-7 h-7 text-indigo-600" /> My Admin Profile
        </h1>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 space-y-8">
          
          {/* Profile Details Form */}
          <div>
            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" /> Personal & Login Details
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
                Profile updated successfully!
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
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
                      <label className="block text-sm font-bold text-slate-700 mb-2">Email Address (Login) *</label>
                      <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                          required
                          disabled={isSaving}
                      />
                      <p className="text-xs text-slate-500 mt-1">Changing email requires confirmation link.</p>
                  </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Profile
                  </>
                )}
              </button>
            </form>
          </div>
          
          {/* Password Change Form */}
          <div>
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
    </AdminLayout>
  );
};

export default AdminProfile;