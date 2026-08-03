import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { User, Calendar, BookOpen, Percent, Link2Off, Loader2 } from 'lucide-react';

interface StudentDetails {
  id: string;
  name: string;
  roll_no: string;
  admission_no: string;
  dob: string | null;
  gender: string | null;
  personal_email: string | null;
  official_email: string | null;
  phone: string | null;
  sectionId: string;
  sectionName: string;
  semester: number;
  batchYear: number;
  deptName: string;
  deptCode: string;
}

export function StudentDashboard() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentDetails | null>(null);
  
  // Attendance metrics
  const [attendance, setAttendance] = useState({ present: 0, total: 0, percentage: 0 });
  
  // Schedule grid
  const [schedule, setSchedule] = useState<any[]>([]);

  const loadStudentData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch Student Profile
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          roll_no,
          admission_no,
          dob,
          gender,
          personal_email,
          official_email,
          phone,
          section_id,
          sections (
            name,
            batches (
              admission_year,
              current_semester,
              departments (
                name,
                code
              )
            )
          )
        `)
        .eq('profile_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const sectionData = data.sections as any;
        const batchData = sectionData?.batches;
        const deptData = batchData?.departments;

        const details: StudentDetails = {
          id: data.id,
          name: data.name,
          roll_no: data.roll_no,
          admission_no: data.admission_no,
          dob: data.dob,
          gender: data.gender,
          personal_email: data.personal_email,
          official_email: data.official_email,
          phone: data.phone,
          sectionId: data.section_id,
          sectionName: sectionData?.name ?? 'N/A',
          semester: batchData?.current_semester ?? 0,
          batchYear: batchData?.admission_year ?? 0,
          deptName: deptData?.name ?? 'N/A',
          deptCode: deptData?.code ?? 'N/A'
        };
        setStudent(details);

        // 2. Fetch Attendance Records (excluding suspended classes)
        const { data: attendanceList } = await supabase
          .from('attendance')
          .select(`
            status,
            sessions (
              status
            )
          `)
          .eq('student_id', data.id);

        let present = 0;
        let total = 0;

        attendanceList?.forEach((att: any) => {
          const session = att.sessions;
          // Only evaluate completed (not cancelled/suspended) classes
          if (session && session.status === 'completed') {
            total++;
            if (att.status === 'present') present++;
          }
        });

        setAttendance({
          present,
          total,
          percentage: total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0
        });

        // 3. Fetch Timetable Schedule slots for this section and current week
        const getCurrentWeekMonday = (dStr?: string) => {
          const d = dStr ? new Date(dStr) : new Date();
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff));
          return monday.toISOString().split('T')[0];
        };
        const weekMonday = getCurrentWeekMonday();

        const { data: timetableSlots } = await supabase
          .from('timetable')
          .select(`
            day_of_week,
            period_no,
            course_offerings!inner (
              section_id,
              courses (code, name),
              faculty (name)
            )
          `)
          .eq('course_offerings.section_id', data.section_id)
          .eq('week_start_date', weekMonday);

        const mapped = (timetableSlots || []).map((s: any) => ({
          day_of_week: s.day_of_week,
          period_number: s.period_no,
          course_offerings: s.course_offerings
        }));
        setSchedule(mapped);
      }
    } catch (err) {
      console.error('Error fetching student details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

  const getGridCell = (day: string, period: number) => {
    return schedule.find(s => s.day_of_week === day && s.period_number === period);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Student Dashboard</h2>
        <p className="text-slate-300 text-sm max-w-2xl">
          Track your classes, monitor cumulative attendance scores, check warnings, and view profile records.
        </p>
      </div>

      {student ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-accent-500" />
              Academic Profile
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400">Name</span>
                <p className="text-sm font-semibold text-slate-800">{student.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-400">Roll No</span>
                  <p className="text-sm font-mono font-semibold text-slate-800">{student.roll_no}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Admission No</span>
                  <p className="text-sm font-mono font-semibold text-slate-800">{student.admission_no}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Department</span>
                <p className="text-sm font-semibold text-slate-800">{student.deptName} ({student.deptCode})</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-400">Official Email</span>
                  <p className="text-sm font-semibold text-slate-800 truncate" title={student.official_email || ''}>{student.official_email || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Personal Email</span>
                  <p className="text-sm font-semibold text-slate-800 truncate" title={student.personal_email || ''}>{student.personal_email || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-400">Batch / Semester</span>
                  <p className="text-sm font-semibold text-slate-800">
                    {student.batchYear} / Sem {student.semester}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Section</span>
                  <p className="text-sm font-semibold text-slate-800">{student.sectionName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Percentage</span>
                  <p className="text-3xl font-black text-slate-800 mt-2">{attendance.percentage}%</p>
                </div>
                <div className={`p-3 rounded-xl border ${attendance.percentage >= 75 ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {attendance.percentage >= 75 
                  ? 'Attendance status safe. Keep attending regularly.' 
                  : 'Warning: Attendance is below 75% requirements.'}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classes Attended</span>
                  <p className="text-3xl font-black text-slate-800 mt-2">
                    {attendance.present} / {attendance.total}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-500 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Refers to total completed, non-suspended academic periods.
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
            Your login account ({user?.email}) is registered as a <strong>Student</strong>, but there is no matching student record in the database.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs text-slate-500 text-left">
            <p className="font-semibold text-slate-600 mb-1">How to fix this:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Ask your administrator to register you in the Students list.</li>
              <li>Ensure they link the student entry to your User ID: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px] select-all">{user?.id}</code></li>
            </ol>
          </div>
        </div>
      )}

      {student && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent-500" />
            Class Schedule ({student.sectionName})
          </h3>
          
          {schedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-600">No scheduled sessions</p>
              <p className="text-xs mt-1">Once faculty initiates roll calls for your section, they will appear here in real-time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-r border-slate-100">Day</th>
                    {periods.map(p => (
                      <th key={p} className="px-4 py-3 text-center">Period {p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {weekdays.map(day => (
                    <tr key={day} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-bold text-slate-700 bg-slate-50/40 border-r border-slate-100">{day}</td>
                      {periods.map(period => {
                        const slot = getGridCell(day, period);
                        const offering = slot?.course_offerings;
                        return (
                          <td key={period} className="px-4 py-4 text-center min-w-[130px] border-r border-slate-50">
                            {slot && offering ? (
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 space-y-1">
                                <p className="font-extrabold text-slate-700 text-[11px]">{offering.courses?.code}</p>
                                <p className="text-[10px] text-slate-500 font-semibold truncate" title={offering.courses?.name}>{offering.courses?.name}</p>
                                <p className="text-[9px] text-slate-400 font-medium">{offering.faculty?.name}</p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-350 italic">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
