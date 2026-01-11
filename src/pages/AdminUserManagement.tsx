"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Users, Edit, Plus, User, Settings, AlertTriangle } from 'lucide-react';
import { Profile } from '../types/auth';
import EditAdminUserDialog from '../components/EditAdminUserDialog';

interface AdminUser extends Profile {
    admin_role: string;
    permissions: { access: string[] };
}

const AdminUserManagement: React.FC = () => {
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchAdminUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching admin users:', error);
            setError('Failed to load admin users.');
        } else {
            setAdminUsers(data as AdminUser[]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAdminUsers();
    }, [fetchAdminUsers]);

    const handleEditUser = (user: AdminUser) => {
        setSelectedUser(user);
        setIsDialogOpen(true);
    };
    
    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedUser(null);
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'project_manager': return 'bg-indigo-100 text-indigo-800';
            case 'owner': return 'bg-red-100 text-red-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Users className="w-7 h-7 text-indigo-600" /> Admin User Management ({adminUsers.length})
                </h1>

                {error && (
                    <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h2 className="text-xl font-bold text-slate-900">Admin Users</h2>
                        {/* Note: Adding new admin users requires creating a new Auth user first, which is complex. 
                           For now, we focus on managing existing admin roles. */}
                        <button 
                            onClick={() => alert("To add a new admin user, please use the Supabase Auth console and set their role to 'admin'.")}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
                        >
                            <Plus className="w-4 h-4" /> Add New Admin
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Admin Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Permissions</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {adminUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.full_name}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{user.email}</td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.admin_role)}`}>
                                                    {user.admin_role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {user.permissions?.access?.length || 0} modules
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button 
                                                    onClick={() => handleEditUser(user)}
                                                    className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1"
                                                >
                                                    <Settings className="w-4 h-4" /> Edit Access
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
            {selectedUser && (
                <EditAdminUserDialog
                    isOpen={isDialogOpen}
                    onClose={handleCloseDialog}
                    onUserUpdated={fetchAdminUsers}
                    initialUser={selectedUser}
                />
            )}
        </AdminLayout>
    );
};

export default AdminUserManagement;