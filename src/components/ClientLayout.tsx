"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import {
  DollarSign, LogOut, User, CalendarCheck,
  Sparkles, Menu, X, HelpCircle, Settings, ClipboardList, Globe,
  LayoutDashboard, ChevronRight, ShieldAlert, FileCheck, PlusCircle,
} from 'lucide-react';

const IMPERSONATION_KEY = 'cwp_admin_view';
const IMPERSONATION_NAME_KEY = 'cwp_admin_name';

interface ClientLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  // Detect admin_view flag from URL params (set by the magic link redirect) and persist in sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('admin_view') === 'true') {
      const name = params.get('admin_name') || 'Admin';
      sessionStorage.setItem(IMPERSONATION_KEY, 'true');
      sessionStorage.setItem(IMPERSONATION_NAME_KEY, name);
    }
    const stored = sessionStorage.getItem(IMPERSONATION_KEY);
    if (stored === 'true') {
      setIsAdminView(true);
      setAdminName(sessionStorage.getItem(IMPERSONATION_NAME_KEY) || 'Admin');
    }
  }, [location.search]);

  const handleExitAdminView = () => {
    sessionStorage.removeItem(IMPERSONATION_KEY);
    sessionStorage.removeItem(IMPERSONATION_NAME_KEY);
    window.close();
    // Fallback in case window.close() is blocked
    window.location.href = '/admin/clients';
  };

  const navSections: NavSection[] = [
    {
      title: 'My Portal',
      items: [
        { name: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard, description: 'Overview & projects' },
        { name: 'New Request', href: '/client/new-request', icon: PlusCircle, description: 'Request new services' },
        { name: 'My Website', href: '/client/website', icon: Globe, description: 'Manage your site' },
        { name: 'Leads', href: '/client/leads', icon: ClipboardList, description: 'Lead management' },
        { name: 'Billing', href: '/client/billing', icon: DollarSign, description: 'Invoices & payments' },
        { name: 'My Proposal', href: '/client/proposals', icon: FileCheck, description: 'View your service proposal' },
      ],
    },
    {
      title: 'With Your Team',
      items: [
        { name: 'Book Appointment', href: '/client/appointments', icon: CalendarCheck, description: 'Schedule a call with admin' },
      ],
    },
    {
      title: 'Account',
      items: [
        { name: 'My Profile', href: '/client/profile', icon: User, description: 'Profile settings' },
        { name: 'Settings', href: '/client/settings', icon: Settings, description: 'Integrations & config' },
        { name: 'Help & Guides', href: '/client/help', icon: HelpCircle, description: 'Support resources' },
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
    if (!name) return 'C';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const isActive = isActiveLink(item.href);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group
          ${isActive
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }
        `}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span className="flex-1">{item.name}</span>
        {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/60" />}
      </Link>
    );
  };

  const SidebarContent = ({ isMobile = false, onNavClick }: { isMobile?: boolean; onNavClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      {!isMobile && (
        <div className="px-5 py-4 border-b border-slate-100">
          <Link to="/client/dashboard" className="block">
            <img src="/CWPlogolight.png" alt="Custom Websites Plus" className="h-8 w-auto object-contain" />
          </Link>
        </div>
      )}

      {/* User Card */}
      <div className={`px-4 py-3 border-b border-slate-100 ${isMobile ? 'mt-14' : ''}`}>
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
            {getInitials(profile?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{profile?.full_name || 'Client'}</p>
            <p className="text-[11px] text-indigo-600 font-medium">Client Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.name} item={item} onClick={onNavClick} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* JetSuite Promo */}
      <div className="px-3 pb-3">
        <Link
          to="/client/jetsuite"
          onClick={onNavClick}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
            isActiveLink('/client/jetsuite')
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border-indigo-200 hover:from-indigo-100 hover:to-violet-100'
          }`}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>JetSuite Tools</span>
          {!isActiveLink('/client/jetsuite') && (
            <span className="ml-auto text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">PRO</span>
          )}
        </Link>
      </div>

      {/* Sign Out */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Admin View Banner */}
      {isAdminView && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-sm font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Admin View — viewing as <strong>{profile?.full_name || 'client'}</strong> (logged in as {adminName})</span>
          </div>
          <button
            onClick={handleExitAdminView}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-bold"
          >
            <X className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      )}
      {/* Mobile Header */}
      <div className={`fixed left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between md:hidden shadow-sm ${isAdminView ? 'top-[36px]' : 'top-0'}`}>
        <Link to="/client/dashboard">
          <img src="/CWPlogolight.png" alt="Custom Websites Plus" className="h-7 w-auto object-contain" />
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className={`hidden md:flex w-60 bg-white border-r border-slate-200 fixed left-0 h-screen flex-col shadow-sm z-30 ${isAdminView ? 'top-[36px]' : 'top-0'}`}>
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <aside
              className="w-64 bg-white h-full flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <SidebarContent isMobile onNavClick={() => setIsMobileMenuOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className={`flex-1 md:ml-60 min-h-screen ${isAdminView ? 'pt-[86px] md:pt-[36px]' : 'pt-14 md:pt-0'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;
