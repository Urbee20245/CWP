"use client";

import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, User, Settings, AlertCircle, Zap, Briefcase, DollarSign, FileText, Mail, CalendarCheck } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { Profile } from '../types/auth';

interface AdminUser extends Profile {
    admin_role: string;
    permissions: { access: string[] };
}

interface EditAdminUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  initialUser: AdminUser;
}

const MODULES = [
    { key: 'dashboard', name: 'Dashboard', icon: Zap },
    { key: 'clients', name: 'Clients', icon: User },
    { key: 'projects', name: 'Projects', icon: Briefcase },
    { key: 'appointments', name: 'Appointments', icon: CalendarCheck },
    { key: 'revenue', name: 'Revenue Dashboard', icon: DollarSign },
    { key: 'billing_products', name: 'Billing Products', icon: DollarSign },
    { key: 'addons_catalog', name: 'Add-ons Catalog', icon: Zap },
    { key: 'ai_docs', name: 'AI Documents', icon: FileText },
    { key: 'ai_email', name: 'AI Email Generator', icon: Mail },
    { key: 'settings', name: 'Settings', icon: Settings },
];

const EditAdminUserDialog: React.FC<EditAdminUserDialogProps> = ({ isOpen, onClose, onUserUpdated, initialUser }) => {
  
  const [formData, setFormData] = useState({
    adminRole: initialUser.admin_role,
    permissions: initialUser.permissions.access || [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when initial data changes
  useEffect(() => {
    if (isOpen) {
        setFormData({
            adminRole: initialUser.admin_role,
            permissions: initialUser.permissions?.access || [],
        });
        setError(null);
    }
  }, [isOpen, initialUser]);

  if (!isOpen) return null;

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, adminRole: e.target.value });
  };
  
  const handlePermissionChange = (moduleKey: string, isChecked: boolean) => {
    setFormData(prev => {
        const newPermissions = isChecked
            ? [...prev.permissions, moduleKey]
            : prev.permissions.filter(key => key !== moduleKey);
        return { ...prev, permissions: newPermissions };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { adminRole, permissions } = formData;

    try {
      // Update Profile Record
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          admin_role: adminRole,
          permissions: { access: permissions },
        })
        .eq('id', initialUser.id);

      if (profileError) throw profileError;

      alert(`Admin user ${initialUser.full_name} updated successfully!`);
      onUserUpdated();
      onClose();

    } catch (e: any) {
      console.error('Admin user update error:', e);
      setError(e.message || 'Failed to update user.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Settings className="w-6 h-6 text-indigo-600" /> Edit Access for {initialUser.full_name}
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
          
          {/* Role Details */}
          <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Role</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={initialUser.full_name}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  disabled
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Admin Role *</label>
                <select
                  name="adminRole"
                  value={formData.adminRole}
                  onChange={handleRoleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isLoading}
                >
                    <option value="owner">Owner (Full Access)</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="billing_manager">Billing Manager</option>
                </select>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Settings className="w-4 h-4" /> Module Access</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {MODULES.map(module => {
                    const Icon = module.icon;
                    return (
                        <label key={module.key} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all">
                            <input
                                type="checkbox"
                                checked={formData.permissions.includes(module.key)}
                                onChange={(e) => handlePermissionChange(module.key, e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                disabled={isLoading}
                            />
                            <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-slate-600" />
                                <span className="text-sm font-medium text-slate-700">{module.name}</span>
                            </div>
                        </label>
                    );
                })}
            </div>
            <p className="text-xs text-slate-500 pt-2">Unchecking a module will hide it from this user's navigation and restrict access to the corresponding page.</p>
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
                Save Permissions
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditAdminUserDialog;