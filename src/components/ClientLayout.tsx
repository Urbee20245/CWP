"use client";

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Briefcase, DollarSign, LogOut, User } from 'lucide-react';

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();

  const navItems = [
    { name: 'Dashboard', href: '/client/dashboard', icon: Briefcase },
    { name: 'Billing', href: '/client/billing', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:block w-64 bg-white border-r border-slate-200 sticky top-20 h-[calc(100vh-80px)] p-6 flex-shrink-0">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-900">Client Portal</h3>
            <p className="text-xs text-slate-500">Welcome, {profile?.full_name || 'Client'}</p>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="mt-8 pt-4 border-t border-slate-100">
            <button 
              onClick={signOut} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors w-full text-left"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;