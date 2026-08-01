import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'program_leader' | 'faculty' | 'student' | 'parent';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for auth changes and set user/session synchronously
  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setRole(null);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession) {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch role reactively in a separate useEffect when user changes
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }

    const userId = user.id;
    let isCurrent = true;
    setLoading(true);

    async function getProfileRole() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();


        if (!isCurrent) return;

        if (error) {
          throw error;
        }
        setRole(data?.role as UserRole ?? null);
      } catch (err) {
        console.error('Error fetching role in useEffect:', err);
        if (isCurrent) {
          setRole(null);
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    getProfileRole();

    return () => {
      isCurrent = false;
    };
  }, [user?.id]);

  return {
    session,
    user,
    role,
    loading,
    isAuthenticated: !!user && !!role,
  };

}
