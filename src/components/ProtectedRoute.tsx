"use client";

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2, ShieldOff } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: Array<'admin' | 'client'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, profile, isLoading, isAdmin, isClient } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    // Redirect unauthenticated users to login page
    return <Navigate to="/back-office/login" state={{ from: location }} replace />;
  }

  // Check if profile data is loaded and role is valid
  if (profile) {
    const userRole = profile.role;
    if (allowedRoles.includes(userRole)) {
      return <Outlet />;
    } else {
      // User is logged in but unauthorized for this route
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center pt-20 text-center p-6">
          <ShieldOff className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You do not have the required permissions to view this page.</p>
          <Navigate to={isAdmin ? '/admin/dashboard' : (isClient ? '/client/dashboard' : '/')} replace />
        </div>
      );
    }
  }

  // Fallback while waiting for profile (should be fast after initial load)
  return (
    <div className="min-h-[80vh] flex items-center justify-center pt-20">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );
};

export default ProtectedRoute;