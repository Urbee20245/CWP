"use client";

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import {
  Users, Briefcase, DollarSign, LogOut, Bot, BarChart3, Settings,
  FileText, Mail as MailIcon, Zap, CalendarCheck, Menu, X, User,
  Phone, Cpu, ChevronDown, ShieldCheck, PhoneCall, Globe, BookOpen,
  LayoutDashboard, Inbox, TrendingUp, Package, Download, FilePlus2,
  Sparkles, CreditCard, Sun, Moon, Layers, Copy,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  collapsible?: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const isDark = theme === 'dark';

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      icon: LayoutDashboard,
      collapsible: false,
      items: [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Clients', href: '/admin/clients', icon: Users },
        { name: 'Projects', href: '/admin/projects', icon: Briefcase },
        { name: 'Appointments', href: '/admin/appointments', icon: CalendarCheck },
        { name: 'Inbox', href: '/admin/inbox', icon: Inbox },
      ],
    },
    {
      title: 'AI Tools',
      icon: Bot,
      collapsible: true,
      items: [
        { name: 'AI Voice', href: '/admin/voice', icon: Phone },
        { name: 'Call Scheduling', href: '/admin/call-scheduling', icon: PhoneCall },
        { name: 'Agent Settings', href: '/admin/agent-settings', icon: Cpu },
        { name: 'Blog Manager', href: '/admin/blog-manager', icon: BookOpen },
        { name: 'A2P Automation', href: '/admin/a2p-automation', icon: ShieldCheck },
        { name: 'AI Documents', href: '/admin/ai-docs', icon: FileText },
        { name: 'AI Email', href: '/admin/ai-email', icon: MailIcon },
      ],
    },
    {
      title: 'Websites',
      icon: Globe,
      collapsible: true,
      items: [
        { name: 'Website Builder', href: '/admin/website-builder', icon: Globe },
        { name: 'Site Import', href: '/admin/site-import', icon: Download },
        { name: 'Claude Assistant', href: '/admin/claude', icon: Bot },
        { name: 'Website Manager', href: '/admin/websites', icon: Layers },
        { name: 'Clone Site', href: '/admin/clone-site', icon: Copy },
      ],
    },
    {
      title: 'Billing',
      icon: TrendingUp,
      collapsible: true,
      items: [
        { name: 'Revenue', href: '/admin/billing/revenue', icon: BarChart3 },
        { name: 'Products', href: '/admin/billing/products', icon: DollarSign },
        { name: 'Add-on Catalog', href: '/admin/addons/catalog', icon: Package },
        { name: 'Proposals', href: '/admin/proposals', icon: FilePlus2 },
        { name: 'Payment Plans', href: '/admin/billing/payment-plan', icon: CreditCard },
        { name: '✨ Gem Onboarding', href: '/admin/onboarding', icon: Sparkles },
      ],
    },
  ];

  const isActiveLink = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => isActiveLink(item.href));
  };

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const isSectionCollapsed = (section: NavSection) => {
    if (!section.collapsible) return false;
    if (isSectionActive(section)) return false;
    return collapsedSections[section.title] ?? false;
  };

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    signOut();
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const NavLink = ({
    item,
    onClick,
    compact = false,
  }: {
    item: NavItem;
    onClick?: () => void;
    compact?: boolean;
  }) => {
    const isActive = isActiveLink(item.href);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
          ${isActive
            ? 'bg-indigo-600 text-white shadow-sm'
            : isDark
              ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }
          ${compact ? 'ml-3' : ''}
        `}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <span className="flex-1 truncate">{item.name}</span>
        {item.badge && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SectionHeader = ({
    section,
  }: {
    section: NavSection;
    isMobile?: boolean;
  }) => {
    const collapsed = isSectionCollapsed(section);
    const active = isSectionActive(section);

    if (!section.collapsible) {
      return (
        <p className={`px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {section.title}
        </p>
      );
    }

    return (
      <button
        onClick={() => toggleSection(section.title)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
          active
            ? 'text-indigo-500'
            : isDark
              ? 'text-slate-500 hover:text-slate-300'
              : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <section.icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          {section.title}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
      </button>
    );
  };

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isDark
          ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {isDark
        ? <Sun className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4 text-slate-400" />
      }
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );

  const SidebarContent = ({ isMobile = false, onNavClick }: { isMobile?: boolean; onNavClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      {!isMobile && (
        <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <Link to="/admin/dashboard" className="block">
            <img
              src={isDark ? '/CWPlogodark.png' : '/CWPlogolight.png'}
              alt="Custom Websites Plus"
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>
      )}

      {/* User Profile */}
      <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'} ${isMobile ? 'mt-14' : ''}`}>
        <div className={`flex items-center gap-3 p-2 rounded-xl border ${
          isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
            {getInitials(profile?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {profile?.full_name || 'Admin'}
            </p>
            <p className="text-[11px] text-indigo-500 font-medium">Administrator</p>
          </div>
          <Link
            to="/admin/profile"
            onClick={onNavClick}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}
            title="My Profile"
          >
            <Settings className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-5">
        {navSections.map((section) => {
          const collapsed = isSectionCollapsed(section);
          return (
            <div key={section.title}>
              <SectionHeader section={section} isMobile={isMobile} />
              {!collapsed && (
                <div className="mt-1 space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink key={item.name} item={item} onClick={onNavClick} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className={`border-t p-3 space-y-0.5 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
        <p className={`px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Admin
        </p>
        {[
          { name: 'Settings', href: '/admin/settings', icon: Settings },
          { name: 'User Access', href: '/admin/users', icon: Users },
          { name: 'My Profile', href: '/admin/profile', icon: User },
        ].map(item => (
          <NavLink key={item.name} item={item} onClick={onNavClick} />
        ))}
      </div>

      {/* Theme Toggle + Sign Out */}
      <div className={`p-3 border-t space-y-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border border-transparent ${
            isDark
              ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400 hover:border-red-900/40'
              : 'text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
          }`}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-slate-900' : 'bg-[#F4F6FA]'}`}>

      {/* Mobile Header */}
      <div className={`fixed top-0 left-0 right-0 z-40 border-b px-4 h-14 flex items-center justify-between md:hidden shadow-sm ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <Link to="/admin/dashboard">
          <img
            src={isDark ? '/CWPlogodark.png' : '/CWPlogolight.png'}
            alt="Custom Websites Plus"
            className="h-7 w-auto object-contain"
          />
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className={`hidden md:flex w-60 border-r fixed top-0 left-0 h-screen flex-col shadow-sm z-30 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <aside
              className={`w-64 h-full flex flex-col shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <SidebarContent isMobile onNavClick={() => setIsMobileMenuOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 md:ml-60 min-h-screen pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
