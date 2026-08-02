import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Layers,
  Users,
  GraduationCap,
  Plus,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  X,
  Info
} from 'lucide-react';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    departments: 0,
    batches: 0,
    sections: 0,
    faculty: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provision state
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{
    created: number;
    skippedNoEmail: number;
    alreadyExisting: number;
    skippedRows: Array<{ type: 'faculty' | 'student'; identifier: string; name: string; reason: string }>;
  } | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
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
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleProvisionLogins = async () => {
    setProvisioning(true);
    setProvisionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('provision-accounts');
      if (error) throw error;
      setProvisionResult(data);
      setShowModal(true);
      // Refresh stats in case profile counts change or counts are updated
      await fetchStats();
    } catch (err: any) {
      alert(`Provisioning failed: ${err.message || err.error_description || 'Unknown error'}`);
    } finally {
      setProvisioning(false);
    }
  };

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

      {/* Admin management area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-4">Academic Quick Controls</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/upload')}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-150 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-accent-50 text-accent-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Add Department</p>
                  <p className="text-xs text-slate-400">Register code & name</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/upload')}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-150 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
              >
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
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Click controls to navigate to structural forms.</span>
          </div>
        </div>

        {/* System Provisioning Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-2">User Accounts Provisioning</h3>
            <p className="text-xs text-slate-400 mb-4">
              Auto-generate auth logins and profiles for all newly uploaded faculty and students.
            </p>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span>Database Connection:</span>
                <span className="font-semibold text-emerald-600">Active (RLS Enforced)</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                <span>Default Password for rosters:</span>
                <span className="font-mono bg-slate-200/60 px-1.5 py-0.5 rounded text-[10px] text-slate-800">abes@1234</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleProvisionLogins}
              disabled={provisioning}
              className="w-full py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-xs font-semibold tracking-wide shadow-md flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {provisioning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Provisioning Logins...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Provision Logins
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Provision Summary Modal */}
      {showModal && provisionResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-800">Logins Provisioning Summary</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Main Counts Grid */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">New Logins Created</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">{provisionResult.created}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Already Existing</span>
                  <p className="text-2xl font-black text-indigo-600 mt-1">{provisionResult.alreadyExisting}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Skipped (No Email)</span>
                  <p className="text-2xl font-black text-amber-600 mt-1">{provisionResult.skippedNoEmail}</p>
                </div>
              </div>

              {/* Warnings / Skipped Rows table */}
              {provisionResult.skippedRows && provisionResult.skippedRows.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Details of Skipped / Failed Rows ({provisionResult.skippedRows.length})
                  </h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm max-h-[220px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[9px] sticky top-0 border-b border-slate-100">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Code/Roll No</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
                        {provisionResult.skippedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-semibold capitalize text-slate-700">{row.type}</td>
                            <td className="px-3 py-2 font-mono text-slate-500">{row.identifier}</td>
                            <td className="px-3 py-2">{row.name}</td>
                            <td className="px-3 py-2 text-rose-600">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl flex gap-3 text-emerald-800 text-xs">
                  <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p>All faculty and students with valid emails were successfully provisioned logins without errors.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wide transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
