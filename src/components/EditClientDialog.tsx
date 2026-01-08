"use client";

import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Briefcase, Mail, Phone, AlertCircle, User } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { Profile } from '../types/auth';

interface ClientData {
  id: string;
  business_name: string;
  phone: string;
  status: string;
  notes: string;
  owner_profile_id: string;
  billing_email: string | null;
  profiles: Profile | null; // Allowing null here to match Supabase join behavior
}

interface EditClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onClientUpdated: () => void;
  initialClientData: ClientData;
}

const EditClientDialog: React.FC<EditClientDialogProps> = ({ isOpen, onClose, onClientUpdated, initialClientData }) => {
  
  // Helper function to safely get profile data or use fallbacks
  const getSafeProfileData = (data: ClientData) => {
    // Provide a fallback Profile object if data.profiles is null
    const profile = data.profiles || {
        id: data.owner_profile_id,
        email: 'N/A',
        full_name: 'N/A (Profile Missing)',
        role: 'client',
        created_at: new Date().toISOString(),
    } as Profile;
    
    return {
        fullName: profile.full_name,
        businessName: data.business_name,
        phone: data.phone,
        billingEmail: data.billing_email || profile.email,
        clientStatus: data.status,
        profileRole: profile.role,
    };
  };
  
  const [formData, setFormData] = useState(getSafeProfileData(initialClientData));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when initial data changes (e.g., when dialog opens with new client data)
  useEffect(() => {
    if (isOpen) {
        setFormData(getSafeProfileData(initialClientData));
        setError(null);
    }
  }, [isOpen, initialClientData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { fullName, businessName, phone, billingEmail, clientStatus, profileRole } = formData;
    const { id: clientId, owner_profile_id: profileId } = initialClientData;

    try {
      // 1. Update Client Record
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          business_name: businessName,
          phone: phone,
          billing_email: billingEmail,
          status: clientStatus,
        })
        .eq('id', clientId);

      if (clientError) throw clientError;

      // 2. Update Profile Record
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          role: profileRole,
        })
        .eq('id', profileId);

      if (profileError) throw profileError;

      alert(`Client ${businessName} updated successfully!`);
      onClientUpdated();
      onClose();

    } catch (e: any) {
      console.error('Client update error:', e);
      setError(e.message || 'Failed to update client.');
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
            <User className="w-6 h-6 text-indigo-600" /> Edit Client Details
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
          
          {/* Profile Details */}
          <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> User Profile</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Profile Role *</label>
                <select
                  name="profileRole"
                  value={formData.profileRole}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isLoading}
                >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>

          {/* Client Business Details */}
          <div className="space-y-4">
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
                <label className="block text-sm font-bold text-slate-700 mb-2">Phone</label>
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
                <label className="block text-sm font-bold text-slate-700 mb-2">Billing Email</label>
                <input
                  type="email"
                  name="billingEmail"
                  value={formData.billingEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Client Status *</label>
                <select
                  name="clientStatus"
                  value={formData.clientStatus}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                  required
                  disabled={isLoading}
                >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="restricted">Restricted</option>
                </select>
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
                Saving Changes...
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
  );
};

export default EditClientDialog;