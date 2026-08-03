import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState<FacultyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [rostersCount, setRostersCount] = useState<number>(0);

  useEffect(() => {
    async function fetchFacultyDetails() {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('faculty')
          .select(`
            id,
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

          // Fetch active academic term
          const { data: activeTerm } = await supabase
            .from('terms')
            .select('id')
            .eq('is_active', true)
            .maybeSingle();

          if (activeTerm) {
            // Fetch total active rosters count
            const { count } = await supabase
              .from('course_offerings')
              .select('*', { count: 'exact', head: true })
              .eq('faculty_id', data.id)
              .eq('term_id', activeTerm.id);
            
            setRostersCount(count || 0);
          }

          // Fetch today's classes
          const getLocalDateString = (d: Date = new Date()): string => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          const todayDate = getLocalDateString();
          
          const getDayName = (dateStr: string): string => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const d = new Date(year, month - 1, day);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[d.getDay()];
          };
          const getCurrentWeekMonday = (dStr: string) => {
            const [year, month, day] = dStr.split('-').map(Number);
            const d = new Date(year, month - 1, day);
            const dayOfWeek = d.getDay();
            const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(year, month - 1, diff);
            const mYear = monday.getFullYear();
            const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
            const mDay = String(monday.getDate()).padStart(2, '0');
            return `${mYear}-${mMonth}-${mDay}`;
          };

          const dayName = getDayName(todayDate);
          const weekMonday = getCurrentWeekMonday(todayDate);

          console.log('FILTER', {facultyId: data.id, dayName, weekMonday, weekType: typeof weekMonday, weekJson: JSON.stringify(weekMonday)});

          const { data: slots, error: ttError } = await supabase
            .from('timetable')
            .select(`
              period_no,
              course_offering_id,
              course_offerings!inner (
                id,
                course_id,
                section_id,
                group_label,
                faculty_id,
                sections (name),
                courses!inner (code, name)
              )
            `)
            .eq('course_offerings.faculty_id', data.id)
            .eq('day_of_week', dayName)
            .eq('week_start_date', weekMonday);

          if (ttError) {
            console.error('QUERY FAILED', ttError.message, ttError.details, ttError.hint, ttError.code);
            throw ttError;
          }

          console.log('Number of timetable rows returned:', slots?.length || 0);

          // Fetch session overrides
          const { data: dateSessions, error: sessError } = await supabase
            .from('sessions')
            .select('course_offering_id, period_no, status')
            .eq('session_date', todayDate);

          if (sessError) {
            console.error('QUERY FAILED', sessError.message, sessError.details, sessError.hint, sessError.code);
            throw sessError;
          }

          const sessionMap = new Map<string, string>();
          dateSessions?.forEach(s => {
            sessionMap.set(`${s.course_offering_id}_${s.period_no}`, s.status);
          });

          const mapped = (slots || []).map((s: any) => {
            const offering = s.course_offerings;
            const status = sessionMap.get(`${offering.id}_${s.period_no}`) || 'pending';
            const secName = offering.section_id 
              ? (offering.group_label ? `${offering.sections?.name || ''} (${offering.group_label})` : (offering.sections?.name || ''))
              : (offering.group_label || 'Group Class');

            return {
              offering_id: offering.id,
              course_code: offering.courses?.code || '',
              course_name: offering.courses?.name || '',
              section_name: secName,
              period_number: s.period_no,
              status
            };
          });

          setTodayClasses(mapped);
        }
      } catch (err) {
        console.error('Error fetching faculty details/classes:', err);
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
                  <p className="text-3xl font-black text-slate-800 mt-2">{todayClasses.length}</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-500 rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {todayClasses.length === 0 
                  ? "No active lecture assignments scheduled today." 
                  : `You have ${todayClasses.length} class${todayClasses.length > 1 ? 'es' : ''} scheduled today.`}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Rosters</span>
                  <p className="text-3xl font-black text-slate-800 mt-2">{rostersCount}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {rostersCount === 0 
                  ? "No student rosters assigned." 
                  : `You manage ${rostersCount} active roster${rostersCount > 1 ? 's' : ''} this semester.`}
              </p>
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
          {todayClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-600">No active classes found today</p>
              <p className="text-xs mt-1">Once courses and batches are allocated, you can toggle live QR codes or manual roll calls here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayClasses.map((cls, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/attendance?offering_id=${cls.offering_id}&period=${cls.period_number}`)}
                  className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-left transition-all space-y-3 shadow-sm bg-white"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-slate-800 text-xs">{cls.course_code}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 border text-slate-550">
                        {cls.section_name}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">{cls.course_name}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] border-t border-slate-50 pt-2">
                    <span className="text-slate-400 font-bold">Period {cls.period_number}</span>
                    <div>
                      {cls.status === 'completed' && (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold text-[9px]">MARKED</span>
                      )}
                      {cls.status === 'cancelled' && (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold text-[9px]">SUSPENDED</span>
                      )}
                      {cls.status === 'pending' && (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-bold text-[9px]">PENDING</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
