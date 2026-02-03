"use client";

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import { Users, Briefcase, DollarSign, LogOut, Bot, BarChart3, Settings, FileText, Mail as MailIcon, Zap, CalendarCheck, Menu, X, User, Phone, Cpu, ChevronRight } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavSection {
  title: string;
  items: { name: string; href: string; icon: React.ElementType }[];
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/admin/dashboard', icon: Bot },
        { name: 'Clients', href: '/admin/clients', icon: Users },
        { name: 'Projects', href: '/admin/projects', icon: Briefcase },
        { name: 'Appointments', href: '/admin/appointments', icon: CalendarCheck },
      ],
    },
    {
      title: 'AI Tools',
      items: [
        { name: 'AI Voice', href: '/admin/voice', icon: Phone },
        { name: 'Agent Settings', href: '/admin/agent-settings', icon: Cpu },
        { name: 'AI Docs', href: '/admin/ai-docs', icon: FileText },
        { name: 'AI Email', href: '/admin/ai-email', icon: MailIcon },
      ],
    },
    {
      title: 'Billing',
      items: [
        { name: 'Revenue', href: '/admin/billing/revenue', icon: BarChart3 },
        { name: 'Products', href: '/admin/billing/products', icon: DollarSign },
        { name: 'Add-ons', href: '/admin/addons/catalog', icon: Zap },
      ],
    },
  ];

  const isActiveLink = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    signOut();
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const NavLink = ({ item, onClick }: { item: { name: string; href: string; icon: React.ElementType }; onClick?: () => void }) => {
    const isActive = isActiveLink(item.href);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 border-l-3 border-indigo-600 -ml-px pl-[13px]'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
        {item.name}
        {isActive && <ChevronRight className="w-4 h-4 ml-auto text-indigo-400" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between md:hidden shadow-sm">
        <Link to="/admin/dashboard" className="flex items-center gap-2">
          <img
            src="/CWPlogolight.png"
            alt="Custom Websites Plus"
            className="h-8 w-auto object-contain"
          />
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-64 bg-white border-r border-slate-200 fixed top-0 left-0 h-screen flex-col shadow-sm">

          {/* Logo Section */}
          <div className="p-5 border-b border-slate-100">
            <Link to="/admin/dashboard" className="block">
              <img
                src="/CWPlogolight.png"
                alt="Custom Websites Plus"
                className="h-9 w-auto object-contain"
              />
            </Link>
          </div>

          {/* User Section */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(profile?.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile?.full_name || 'Admin'}</p>
                <p className="text-xs text-slate-500">Administrator</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {navSections.map((section, idx) => (
              <div key={section.title} className={idx > 0 ? 'mt-6' : ''}>
                <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer Links */}
          <div className="border-t border-slate-100 p-3 bg-slate-50/30">
            <div className="space-y-1">
              <Link
                to="/admin/settings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActiveLink('/admin/settings')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Settings className={`w-[18px] h-[18px] ${isActiveLink('/admin/settings') ? 'text-indigo-600' : 'text-slate-400'}`} />
                Settings
              </Link>
              <Link
                to="/admin/users"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActiveLink('/admin/users')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Users className={`w-[18px] h-[18px] ${isActiveLink('/admin/users') ? 'text-indigo-600' : 'text-slate-400'}`} />
                User Access
              </Link>
              <Link
                to="/admin/profile"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActiveLink('/admin/profile')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <User className={`w-[18px] h-[18px] ${isActiveLink('/admin/profile') ? 'text-indigo-600' : 'text-slate-400'}`} />
                My Profile
              </Link>
            </div>
          </div>

          {/* Sign Out Button - Always Visible */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all border border-red-100"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-72 bg-white h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>

              {/* Mobile User Section */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 mt-14">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(profile?.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{profile?.full_name || 'Admin'}</p>
                    <p className="text-xs text-slate-500">Administrator</p>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation */}
              <nav className="px-3 py-4">
                {navSections.map((section, idx) => (
                  <div key={section.title} className={idx > 0 ? 'mt-6' : ''}>
                    <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {section.title}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <NavLink key={item.name} item={item} onClick={() => setIsMobileMenuOpen(false)} />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Mobile Footer Links */}
              <div className="border-t border-slate-100 p-3">
                <div className="space-y-1">
                  <Link
                    to="/admin/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                  >
                    <Settings className="w-[18px] h-[18px] text-slate-400" />
                    Settings
                  </Link>
                  <Link
                    to="/admin/users"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                  >
                    <Users className="w-[18px] h-[18px] text-slate-400" />
                    User Access
                  </Link>
                  <Link
                    to="/admin/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                  >
                    <User className="w-[18px] h-[18px] text-slate-400" />
                    My Profile
                  </Link>
                </div>
              </div>

              {/* Mobile Sign Out */}
              <div className="p-3 border-t border-slate-200">
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all border border-red-100"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
