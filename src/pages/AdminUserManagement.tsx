"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Users, Plus, Edit, Trash2, AlertCircle, UserPlus, Save, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Profile } from '../types/auth';

// Define the granular roles
const ADMIN_ROLES = [
    { value: 'super_admin', label: 'Super Admin (Full Access)' },
    { value: 'project_manager', label: 'Project Manager (Projects, Tasks, Files, Messages)' },
    { value: 'billing_manager', label: 'Billing Manager (Billing, Invoices, Revenue)' },
    { value: 'support_agent', label: 'Support Agent (Clients, Messages, Appointments)' },
];

interface AdminUser extends Profile {
    admin_role: string;
}

const AdminUserManagement: React.FC = () => {
    const { profile } = useAuth();
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState<AdminUser | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    
    const [newUserData, setNewUserData] = useState({
        email: '',
        password: '',
        fullName: '',
        adminRole: 'project_manager',
    });

    const fetchAdminUsers = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('full_name');

        if (error) {
            console.error('Error fetching admin users:', error);
            setFormError('Failed to load admin users.');
        } else {
            setAdminUsers(data as AdminUser[]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAdminUsers();
    }, [fetchAdminUsers]);
    
    const handleNewFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setNewUserData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (isEditing) {
            setIsEditing(prev => prev ? { ...prev, [e.target.name]: e.target.value } : null);
        }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setIsCreating(true);

        const { email, password, fullName, adminRole } = newUserData;

        if (!email || !password || !fullName) {
            setFormError('All fields are required.');
            setIsCreating(false);
            return;
        }
        
        try {
            // Invoke the Edge Function to create the user securely
            const { data, error } = await supabase.functions.invoke('create-admin-user', {
                body: JSON.stringify({
                    email,
                    password,
                    fullName,
                    adminRole,
                }),
            });
            
            if (error || data.error) throw new Error(error?.message || data.error);

            alert(`Admin user '${fullName}' created successfully with role ${adminRole}!`);
            setNewUserData({ email: '', password: '', fullName: '', adminRole: 'project_manager' });
            fetchAdminUsers();
        } catch (e: any) {
            setFormError(e.message || 'Failed to create admin user. Check if email is already in use.');
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleUpdateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing) return;
        
        setIsLoading(true);
        setFormError(null);
        
        try {
            // Update Profile Role and Name
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    full_name: isEditing.full_name,
                    admin_role: isEditing.admin_role,
                })
                .eq('id', isEditing.id);
                
            if (profileError) throw profileError;
            
            alert(`Admin user ${isEditing.full_name} updated successfully!`);
            setIsEditing(null);
            fetchAdminUsers();
        } catch (e: any) {
            setFormError(e.message || 'Failed to update admin user.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDeleteAdmin = async (user: AdminUser) => {
        if (user.admin_role === 'super_admin' && adminUsers.filter(u => u.admin_role === 'super_admin').length === 1) {
            alert("Cannot delete the last Super Admin.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete admin user ${user.full_name}? This will delete their account and profile.`)) return;
        
        setIsLoading(true);
        try {
            // Invoke the Edge Function to delete the user securely
            const { error } = await supabase.functions.invoke('delete-admin-user', {
                body: JSON.stringify({ userId: user.id }),
            });
            
            if (error) throw error;
            
            alert(`Admin user ${user.full_name} deleted successfully.`);
            fetchAdminUsers();
        } catch (e: any) {
            alert(`Failed to delete user: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'super_admin': return 'bg-red-100 text-red-800';
            case 'billing_manager': return 'bg-purple-100 text-purple-800';
            case 'project_manager': return 'bg-indigo-100 text-indigo-800';
            case 'support_agent': return 'bg-emerald-100 text-emerald-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    // Restrict access to Super Admins only
    if (profile?.admin_role !== 'super_admin') {
        return (
            <AdminLayout>
                <div className="max-w-xl mx-auto p-8 mt-12 bg-red-50 border border-red-200 rounded-xl text-center">
                    <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-800">Permission Denied</h1>
                    <p className="text-red-700 mt-2">Only Super Admins can manage user accounts.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Users className="w-7 h-7 text-indigo-600" /> Admin User Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Create New Admin */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-fit">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <UserPlus className="w-5 h-5 text-indigo-600" /> Create New Admin
                        </h2>
                        
                        {formError && (
                            <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateAdmin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={newUserData.fullName}
                                    onChange={handleNewFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isCreating}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={newUserData.email}
                                    onChange={handleNewFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isCreating}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Temporary Password *</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={newUserData.password}
                                    onChange={handleNewFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isCreating}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Admin Role *</label>
                                <select
                                    name="adminRole"
                                    value={newUserData.adminRole}
                                    onChange={handleNewFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isCreating}
                                >
                                    {ADMIN_ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                {isCreating ? 'Creating...' : 'Create Admin User'}
                            </button>
                        </form>
                    </div>

                    {/* Right Column: Admin List */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">
                            Active Admin Users ({adminUsers.length})
                        </h2>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-32">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {adminUsers.map(user => (
                                    <div key={user.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 truncate">{user.full_name}</p>
                                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(user.admin_role)}`}>
                                                {ADMIN_ROLES.find(r => r.value === user.admin_role)?.label || user.admin_role}
                                            </span>
                                            <button 
                                                onClick={() => setIsEditing(user)}
                                                className="p-1 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteAdmin(user)}
                                                disabled={user.admin_role === 'super_admin' && adminUsers.filter(u => u.admin_role === 'super_admin').length === 1}
                                                className="p-1 rounded-full text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <Edit className="w-6 h-6 text-indigo-600" /> Edit Admin User
                            </h3>
                            <button onClick={() => setIsEditing(null)} className="text-slate-500 hover:text-slate-900">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateAdmin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    value={isEditing.full_name}
                                    onChange={handleEditFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={isEditing.email}
                                    readOnly
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Admin Role *</label>
                                <select
                                    name="admin_role"
                                    value={isEditing.admin_role}
                                    onChange={handleEditFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isLoading}
                                >
                                    {ADMIN_ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminUserManagement;