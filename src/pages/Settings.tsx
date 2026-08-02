import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Key, ShieldAlert, CheckCircle } from 'lucide-react';

export function Settings() {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      // 1. Update Auth user password
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      // 2. Mark password_changed = true in public profiles
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ password_changed: true })
          .eq('id', user.id);

        if (profileError) throw profileError;

        setSuccessMsg('Your account password was updated successfully.');
        setPassword('');
        setConfirmPassword('');
      } else {
        throw new Error('User session not found.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Account Settings</h2>
        <p className="text-slate-300 text-sm max-w-2xl">
          Customize your credentials, adjust privacy settings, and configure auth preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm mb-2">Profile Info</h3>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-accent-600 flex items-center justify-center text-white font-extrabold text-sm shadow">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{user?.email?.split('@')[0]}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Security Settings: Change Password</h3>

          {errorMsg && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-800 text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <p>{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-250 rounded-xl flex gap-3 text-emerald-800 text-xs">
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <p>{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">New Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full p-2.5 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                  placeholder="••••••••"
                />
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full p-2.5 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                  placeholder="••••••••"
                />
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating Password...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
