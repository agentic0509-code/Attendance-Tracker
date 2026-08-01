import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

import {
  LayoutDashboard,
  Users,
  CheckSquare,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  BookOpen,
  ShieldCheck,
  Award,
  GraduationCap,
  Sparkles
} from 'lucide-react';

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Generate dynamic side nav links based on role
  const getNavItems = (userRole: UserRole | null) => {
    switch (userRole) {
      case 'admin':
        return [
          { name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard },
          { name: 'Departments', path: '/departments', icon: BookOpen },
          { name: 'Settings', path: '/settings', icon: Settings },
        ];
      case 'program_leader':
        return [
          { name: 'PL Dashboard', path: '/pl', icon: LayoutDashboard },
          { name: 'Batches', path: '/batches', icon: BookOpen },
          { name: 'Settings', path: '/settings', icon: Settings },
        ];
      case 'faculty':
        return [
          { name: 'Faculty Dashboard', path: '/faculty', icon: LayoutDashboard },
          { name: 'Take Attendance', path: '/attendance', icon: CheckSquare },
          { name: 'Settings', path: '/settings', icon: Settings },
        ];
      case 'student':
        return [
          { name: 'Student Dashboard', path: '/student', icon: LayoutDashboard },
          { name: 'My Attendance', path: '/my-attendance', icon: FileBarChart },
          { name: 'Settings', path: '/settings', icon: Settings },
        ];
      case 'parent':
        return [
          { name: 'Parent Dashboard', path: '/parent', icon: LayoutDashboard },
          { name: 'Settings', path: '/settings', icon: Settings },
        ];
      default:
        return [
          { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        ];
    }
  };

  const navItems = getNavItems(role);

  const getPageTitle = () => {
    const currentItem = navItems.find((item) => item.path === location.pathname);
    return currentItem ? currentItem.name : 'Overview';
  };

  const getRoleBadge = (userRole: UserRole | null) => {
    switch (userRole) {
      case 'admin':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
            <ShieldCheck className="w-3 h-3" />
            Admin
          </span>
        );
      case 'program_leader':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <Award className="w-3 h-3" />
            PL Leader
          </span>
        );
      case 'faculty':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
            <Users className="w-3 h-3" />
            Faculty
          </span>
        );
      case 'student':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <GraduationCap className="w-3 h-3" />
            Student
          </span>
        );
      case 'parent':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
            <Sparkles className="w-3 h-3" />
            Parent
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/25">
            User
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-navy-900 text-slate-100 flex-shrink-0 border-r border-navy-800 transition-all duration-300">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-navy-800 bg-navy-950">
          <BookOpen className="w-6 h-6 text-accent-400" />
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            RollCall AI
          </span>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                    : 'text-slate-400 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile Info */}
        <div className="p-4 border-t border-navy-800 bg-navy-950">
          <div className="flex flex-col gap-2 mb-4 px-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate capitalize">{role || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="mt-1 flex justify-start">
              {getRoleBadge(role)}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 text-slate-100 flex flex-col border-r border-navy-800 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-navy-800 bg-navy-950">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-accent-400" />
            <span className="font-bold text-lg tracking-tight text-white">RollCall AI</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                    : 'text-slate-400 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-navy-800 bg-navy-950">
          <div className="flex flex-col gap-2 mb-4 px-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate capitalize">{role || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="mt-1 flex justify-start">
              {getRoleBadge(role)}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-800">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification bell (placeholder) */}
            <button className="relative text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>

            <div className="h-6 w-px bg-slate-200"></div>

            {/* Profile Dropdown Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs border border-slate-200">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-sm font-semibold text-slate-700">
                  {user?.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400 capitalize font-medium">
                  {role || 'User'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
