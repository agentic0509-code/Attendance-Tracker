import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { BookOpen, Key, User, AlertCircle, CheckCircle, ArrowRight, HelpCircle } from 'lucide-react';

export function Login() {
  // Mode toggle: login page or forgot password page
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  
  // Login form inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot form inputs
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  
  // General UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  const navigate = useNavigate();
  const { isAuthenticated, user, role, loading: authLoading } = useAuth();

  // If already authenticated, redirect to root route
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Check if Supabase keys are setup
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url === 'https://placeholder.supabase.co' || url.includes('your-supabase-project')) {
      setIsConfigured(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Call RPC function public.get_login_email to resolve input identifier to actual email
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_login_email', {
        identifier: identifier.trim()
      });

      if (rpcError) throw rpcError;

      if (!resolvedEmail) {
        throw new Error('No account found matching this Employee Code / Roll Number / Email.');
      }

      // 2. Perform authentication with the resolved email address
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (loginError) throw loginError;

      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Call RPC function public.get_login_email to resolve input identifier
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_login_email', {
        identifier: forgotIdentifier.trim()
      });

      if (rpcError) throw rpcError;

      if (!resolvedEmail) {
        throw new Error('No account found matching this Employee Code / Roll Number / Email.');
      }

      // 2. Request Supabase password reset link
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccessMsg('A password reset link has been dispatched to your official registered email address.');
      setForgotIdentifier('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 bg-accent-600 rounded-2xl flex items-center justify-center shadow-lg shadow-accent-600/35">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">RollCall AI</span>
        </div>
        
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          {mode === 'login' ? 'Sign in to your account' : 'Recover Password'}
        </h2>
        
        <p className="mt-2 text-center text-sm text-slate-400">
          {mode === 'login' 
            ? 'Enter your academic credentials below' 
            : 'Enter your Code or Roll Number to request a reset link'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          
          {/* Environment configuration warning */}
          {!isConfigured && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3 text-amber-255 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
              <div>
                <strong className="font-semibold text-amber-300">Configuration Required:</strong>
                <p className="mt-1 leading-normal text-slate-300">
                  Supabase URL and Anon Key are not configured in `.env`. Replace placeholders with your own keys to test real authentication.
                </p>
              </div>
            </div>
          )}

          {/* Missing database profiles warning */}
          {!authLoading && user && !role && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3 text-amber-255 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 font-bold" />
              <div>
                <strong className="font-semibold text-amber-300">Account Profile Missing:</strong>
                <p className="mt-1 leading-normal text-slate-300">
                  You are authenticated in Supabase as <strong className="text-white">{user.email}</strong>, but no profile details match this account in the database. Please run the migration script and create your profile.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="mt-2.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors shadow"
                >
                  Clear Session / Log Out
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex gap-3 text-rose-200 text-xs animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <div>
                <strong className="font-semibold text-rose-300">Authentication Error</strong>
                <p className="mt-1 leading-normal">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex gap-3 text-emerald-250 text-xs">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-450" />
              <div>
                <strong className="font-semibold text-emerald-350">Request Dispatched</strong>
                <p className="mt-1 leading-normal text-slate-200">{successMsg}</p>
              </div>
            </div>
          )}

          {mode === 'login' ? (
            /* Login Form */
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-semibold text-slate-300">
                  Employee Code / Roll Number / Email
                </label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all text-sm"
                    placeholder="e.g. EMP123 or student_roll_no"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-accent-400 hover:text-accent-300 font-semibold"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isConfigured}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-accent-600 hover:bg-accent-500 active:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-accent-500 transition-all shadow-lg shadow-accent-600/20 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Forgot Password Form */
            <form className="space-y-6" onSubmit={handleForgotPassword}>
              <div>
                <label className="block text-sm font-semibold text-slate-300">
                  Employee Code / Roll Number / Email
                </label>
                <div className="mt-1.5 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HelpCircle className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all text-sm"
                    placeholder="e.g. EMP123 or student_roll_no"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isConfigured}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-accent-600 hover:bg-accent-500 transition-all shadow-lg disabled:opacity-50 group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-450 hover:text-slate-300 font-semibold"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
