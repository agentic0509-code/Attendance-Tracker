import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { User, ClipboardList, Briefcase, GraduationCap, Link2Off } from 'lucide-react';

interface FacultyDetails {
  name: string;
  employee_code: string;
  department: {
    name: string;
    code: string;
  } | null;
}

export function FacultyDashboard() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<FacultyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFacultyDetails() {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('faculty')
          .select(`
            name,
            employee_code,
            departments (
              name,
              code
            )
          `)
          .eq('profile_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setFaculty({
            name: data.name,
            employee_code: data.employee_code,
            department: Array.isArray(data.departments) 
              ? data.departments[0] 
              : (data.departments as any) ?? null
          });
        }
      } catch (err) {
        console.error('Error fetching faculty details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFacultyDetails();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Faculty Dashboard</h2>
        <p className="text-slate-200 text-sm max-w-2xl">
          Launch roll calls, track student attendance compliance, submit leave requests, and manage grading sheets.
        </p>
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
      ) : faculty ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-accent-500" />
              Faculty Profile
            </h3>
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <span className="text-xs text-slate-400">Name</span>
                <p className="text-sm font-semibold text-slate-800">{faculty.name}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Employee Code</span>
                <p className="text-sm font-mono font-semibold text-slate-800">{faculty.employee_code}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Department</span>
                <p className="text-sm font-semibold text-slate-800">
                  {faculty.department ? `${faculty.department.name} (${faculty.department.code})` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Stats / Work Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Classes Today</span>
                  <p className="text-3xl font-black text-slate-800 mt-2">0</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-500 rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">No active lecture assignments scheduled.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Rosters</span>
                  <p className="text-3xl font-black text-slate-800 mt-2">0</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">No student rosters assigned.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Link2Off className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Profile Connection</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">
            Your login account ({user?.email}) is registered as <strong>Faculty</strong>, but there is no corresponding faculty profile entry in the database.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs text-slate-500 text-left">
            <p className="font-semibold text-slate-600 mb-1">How to fix this:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Ask your administrator to register you in the Faculty list.</li>
              <li>Ensure they link the faculty entry to your User ID: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px] select-all">{user?.id}</code></li>
            </ol>
          </div>
        </div>
      )}

      {faculty && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-accent-500" />
            Class Attendance Toggles
          </h3>
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-600">No active classes found</p>
            <p className="text-xs mt-1">Once courses and batches are allocated, you can toggle live QR codes or manual roll calls here.</p>
          </div>
        </div>
      )}
    </div>
  );
}
