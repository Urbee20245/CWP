"use client";

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Users, Briefcase, DollarSign, LogOut, Bot, BarChart3, Settings, FileText, Mail, Zap, CalendarCheck } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();

  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: Bot },
    { name: 'Clients', href: '/admin/clients', icon: Users }, // Changed to dedicated client list route
    { name: 'Projects', href: '/admin/projects', icon: Briefcase }, // New dedicated project list route
    { name: 'Appointments', href: '/admin/appointments', icon: CalendarCheck }, // NEW APPOINTMENTS LINK
    { name: 'Revenue', href: '/admin/billing/revenue', icon: BarChart3 },
    { name: 'Billing Products', href: '/admin/billing/products', icon: DollarSign }, 
    { name: 'Add-ons Catalog', href: '/admin/addons/catalog', icon: Zap },
    { name: 'AI Docs', href: '/admin/ai-docs', icon: FileText },
    { name: 'AI Email', href: '/admin/ai-email', icon: Mail }, // New AI Email link
    { name: 'Settings', href: '/admin/settings', icon: Settings }, // New Settings link
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:block w-64 bg-white border-r border-slate-200 sticky top-20 h-[calc(100vh-80px)] p-6 flex-shrink-0">
          
          {/* Logo */}
          <Link to="/admin/dashboard" className="mb-6 block">
            <img 
              src="/CWPlogolight.png" 
              alt="Custom Websites Plus" 
              className="h-10 w-auto object-contain"
            />
          </Link>
          
          <div className="mb-8 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Admin Panel</h3>
            <p className="text-xs text-slate-500">Welcome, {profile?.full_name || 'Admin'}</p>
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

export default AdminLayout;