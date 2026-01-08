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

  // STEP 1: Show simple loading UI while session is resolving (Step 3 & 5)
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // STEP 2: Check authentication status
  if (!user) {
    // Redirect unauthenticated users to login page (Step 5)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // STEP 3: Check authorization status
  if (profile) {
    const userRole = profile.role;
    if (allowedRoles.includes(userRole)) {
      return <Outlet />;
    } else {
      // User is logged in but unauthorized for this route
      // Redirect to their appropriate dashboard or home
      const redirectPath = isAdmin ? '/admin/dashboard' : (isClient ? '/client/dashboard' : '/');
      
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center pt-20 text-center p-6">
          <ShieldOff className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-4">You do not have the required permissions to view this page.</p>
          <Navigate to={redirectPath} replace />
        </div>
      );
    }
  }

  // STEP 4: Fallback if user exists but profile is still null (e.g., profile creation failed)
  // This should be rare due to the robust isLoading check, but we handle it gracefully.
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center pt-20 text-center p-6">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Profile Setup Required</h1>
        <p className="text-slate-600">Please contact support to finalize your account setup.</p>
        <button onClick={() => <Navigate to="/login" replace />} className="mt-4 text-indigo-600">Go to Login</button>
    </div>
  );
};

export default ProtectedRoute;