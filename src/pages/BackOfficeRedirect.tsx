"use client";

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

const BackOfficeRedirect: React.FC = () => {
  const { profile, isLoading, isAdmin, isClient } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (isClient) {
    return <Navigate to="/client/dashboard" replace />;
  }

  // Should not happen if protected, but redirect to login if no role found
  return <Navigate to="/back-office/login" replace />;
};

export default BackOfficeRedirect;