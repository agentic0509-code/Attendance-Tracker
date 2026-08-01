import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../hooks/useAuth';


interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const getDashboardPath = (role: UserRole | null): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'program_leader':
      return '/pl';
    case 'faculty':
      return '/faculty';
    case 'student':
      return '/student';
    case 'parent':
      return '/parent';
    default:
      return '/login';
  }
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-screen flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700/50"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-accent-500 animate-spin"></div>
          </div>
          <p className="text-slate-400 font-medium text-sm animate-pulse">Loading secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect authenticated users to their own dashboard if they don't have access to this route
    return <Navigate to={getDashboardPath(role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
