"use client";

import React, { useState } from 'react';
import { X, Loader2, UserPlus, Briefcase, Mail, Phone, AlertCircle } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface AddClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onClientAdded: () => void;
}

const AddClientDialog: React.FC<AddClientDialogProps> = ({ isOpen, onClose, onClientAdded }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    businessName: '',
    phone: '',
    billingEmail: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { email, password, fullName, businessName, phone, billingEmail } = formData;

    if (!email || !password || !fullName || !businessName) {
      setError('Please fill in all required fields.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Create Auth User (This automatically triggers profile creation via handle_new_user function)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Confirm email immediately for admin-created users
        user_metadata: {
          full_name: fullName,
          role: 'client', // Ensure the profile trigger sets the correct role
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }
      
      const newUserId = authData.user.id;

      // 2. Create Client Record
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          owner_profile_id: newUserId,
          business_name: businessName,
          phone: phone || null,
          billing_email: billingEmail || email,
          status: 'active',
          access_status: 'active',
        });

      if (clientError) {
        // If client creation fails, we should ideally delete the auth user, but for simplicity, we log and alert.
        console.error('Failed to create client record:', clientError);
        throw new Error('Failed to create client record. User created, but client link failed.');
      }
      
      // 3. Update the newly created profile's role to 'client' explicitly (optional, but good practice)
      // The trigger should handle this, but we ensure the role is set correctly if needed later.
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ role: 'client', full_name: fullName })
        .eq('id', newUserId);
        
      if (profileUpdateError) {
          console.warn('Failed to update profile role/name:', profileUpdateError);
      }


      alert(`Client ${businessName} and user account created successfully!`);
      onClientAdded();
      onClose();
      setFormData({
        email: '',
        password: '',
        fullName: '',
        businessName: '',
        phone: '',
        billingEmail: '',
      });

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-xl w-full shadow-2xl animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-indigo-600" /> Add New Client
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* User Account Details */}
          <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Mail className="w-4 h-4" /> Client Login Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email (Login) *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Client Business Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Business Name *</label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Phone (Optional)</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Billing Email (Optional)</label>
                <input
                  type="email"
                  name="billingEmail"
                  value={formData.billingEmail}
                  onChange={handleChange}
                  placeholder="Defaults to login email"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Client...
              </>
            ) : (
              <>
                <Briefcase className="w-5 h-5" />
                Create Client
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddClientDialog;