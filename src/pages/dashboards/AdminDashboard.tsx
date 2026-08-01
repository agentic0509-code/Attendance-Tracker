import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  Calendar,
  Layers,
  Users,
  GraduationCap,
  Plus,
  ShieldAlert
} from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    departments: 0,
    batches: 0,
    sections: 0,
    faculty: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);

      try {
        // Fetch exact counts from each table
        const [
          { count: deptCount, error: deptErr },
          { count: batchCount, error: batchErr },
          { count: sectionCount, error: secErr },
          { count: facultyCount, error: facErr },
          { count: studentCount, error: studErr }
        ] = await Promise.all([
          supabase.from('departments').select('*', { count: 'exact', head: true }),
          supabase.from('batches').select('*', { count: 'exact', head: true }),
          supabase.from('sections').select('*', { count: 'exact', head: true }),
          supabase.from('faculty').select('*', { count: 'exact', head: true }),
          supabase.from('students').select('*', { count: 'exact', head: true })
        ]);

        if (deptErr || batchErr || secErr || facErr || studErr) {
          throw new Error('Some database queries failed. Please check permissions and database setup.');
        }

        setStats({
          departments: deptCount ?? 0,
          batches: batchCount ?? 0,
          sections: sectionCount ?? 0,
          faculty: facultyCount ?? 0,
          students: studentCount ?? 0,
        });
      } catch (err: any) {
        console.error('Error fetching admin dashboard stats:', err);
        setError(err.message || 'Error communicating with database.');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const adminStats = [
    { name: 'Departments', value: stats.departments, icon: Building2, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { name: 'Batches', value: stats.batches, icon: Calendar, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { name: 'Sections', value: stats.sections, icon: Layers, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
    { name: 'Faculty Staff', value: stats.faculty, icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { name: 'Registered Students', value: stats.students, icon: GraduationCap, color: 'text-rose-600 bg-rose-50 border-rose-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Admin Control Center</h2>
        <p className="text-slate-300 text-sm max-w-2xl">
          System-wide overview and configurations. Manage academic structures, register departments, assign batches, and oversee users.
        </p>
      </div>

      {/* Database Error Banner */}
      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3 text-amber-800 dark:text-amber-200 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <div>
            <strong className="font-semibold">Database Check Warning:</strong>
            <p className="mt-1 leading-normal text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state or stats grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {adminStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.name}
                className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.name}</span>
                  <div className={`p-2 rounded-xl border ${stat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{stat.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin management area placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Academic Quick Controls</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-150 hover:border-slate-300 hover:bg-slate-50 transition-all text-left">
              <div className="p-2 rounded-lg bg-accent-50 text-accent-600">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Add Department</p>
                <p className="text-xs text-slate-400">Register code & name</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-150 hover:border-slate-300 hover:bg-slate-50 transition-all text-left">
              <div className="p-2 rounded-lg bg-accent-50 text-accent-600">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Add Batch</p>
                <p className="text-xs text-slate-400">Define semesters & years</p>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-2">System Config</h3>
            <p className="text-xs text-slate-400 mb-4">Core platform logs and authentication</p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs text-slate-600">
              <span>Database Connection:</span>
              <span className="font-semibold text-emerald-600">Active (RLS Enforced)</span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 mt-4">
            Database schema v1.0
          </div>
        </div>
      </div>
    </div>
  );
}
