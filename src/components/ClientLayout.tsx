"use client";

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Briefcase, DollarSign, LogOut, User, Zap, CalendarCheck, Sparkles, Menu, X, ArrowRight } from 'lucide-react';

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', href: '/client/dashboard', icon: Briefcase },
    { name: 'Appointments', href: '/client/appointments', icon: CalendarCheck },
    { name: 'Billing', href: '/client/billing', icon: DollarSign },
    { name: 'Add-ons', href: '/client/addons', icon: Zap },
    { name: 'My Profile', href: '/client/profile', icon: User }, 
  ];
  
  const jetSuiteItem = { name: 'JetSuite DIY', href: '/client/jetsuite', icon: Sparkles };
  
  const handleSignOut = () => {
      setIsMobileMenuOpen(false);
      signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-16 md:pt-20">
      
      {/* Mobile Header (Fixed on top) */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 p-3 flex items-center justify-between md:hidden">
          <Link to="/client/dashboard">
              <img 
                  src="/CWPlogolight.png" 
                  alt="Custom Websites Plus" 
                  className="h-8 w-auto object-contain"
              />
          </Link>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600 hover:text-indigo-600">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
      </div>

      <div className="flex">
        {/* Sidebar (Desktop) */}
        <div className="hidden md:block w-64 bg-white border-r border-slate-200 sticky top-20 h-[calc(100vh-80px)] p-6 flex-shrink-0 flex flex-col">
          
          {/* Logo */}
          <Link to="/client/dashboard" className="mb-6 block">
            <img 
              src="/CWPlogolight.png" 
              alt="Custom Websites Plus" 
              className="h-10 w-auto object-contain"
            />
          </Link>
          
          <div className="mb-8 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Client Portal</h3>
            <p className="text-xs text-slate-500">Welcome, {profile?.full_name || 'Client'}</p>
          </div>
          
          {/* Main Navigation Links */}
          <nav className="space-y-2 flex-1">
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
          
          {/* JetSuite DIY Link (Reverted to Link style) */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link
                to={jetSuiteItem.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors w-full text-left"
            >
                <jetSuiteItem.icon className="w-5 h-5" />
                {jetSuiteItem.name}
            </Link>
          </div>
          
          {/* Sign Out Button */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button 
              onClick={handleSignOut} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full text-left border border-red-100 hover:border-red-200"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
        
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
            <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="w-64 bg-white h-full p-6 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-slate-900">Client Portal</h3>
                        <p className="text-xs text-slate-500">Welcome, {profile?.full_name || 'Client'}</p>
                    </div>
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                    
                    {/* Mobile JetSuite Link (Reverted to Link style) */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <Link
                            to={jetSuiteItem.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors w-full text-left"
                        >
                            <jetSuiteItem.icon className="w-5 h-5" />
                            {jetSuiteItem.name}
                        </Link>
                    </div>
                    
                    {/* Mobile Sign Out Button */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <button 
                            onClick={handleSignOut} 
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full text-left border border-red-100 hover:border-red-200"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;