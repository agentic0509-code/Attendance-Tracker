import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { User, Calendar, BookOpen, Percent, Link2Off } from 'lucide-react';

interface StudentDetails {
  name: string;
  roll_no: string;
  admission_no: string;
  dob: string | null;
  gender: string | null;
  personal_email: string | null;
  official_email: string | null;
  phone: string | null;
  sectionName: string;
  semester: number;
  batchYear: number;
  deptName: string;
  deptCode: string;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudentDetails() {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('students')
          .select(`
            name,
            roll_no,
            admission_no,
            dob,
            gender,
            personal_email,
            official_email,
            phone,
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

          setStudent({
            name: data.name,
            roll_no: data.roll_no,
            admission_no: data.admission_no,
            dob: data.dob,
            gender: data.gender,
            personal_email: data.personal_email,
            official_email: data.official_email,
            phone: data.phone,
            sectionName: sectionData?.name ?? 'N/A',
            semester: batchData?.current_semester ?? 0,
            batchYear: batchData?.admission_year ?? 0,
            deptName: deptData?.name ?? 'N/A',
            deptCode: deptData?.code ?? 'N/A'
          });
        }
      } catch (err) {
        console.error('Error fetching student details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStudentDetails();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Student Dashboard</h2>
        <p className="text-slate-200 text-sm max-w-2xl">
          Track your classes, monitor cumulative attendance scores, check warnings, and view profile records.
        </p>
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
      ) : student ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-accent-500" />
              Student Profile
            </h3>
            <div className="border-t border-slate-100 pt-4 space-y-3">
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
                  <p className="text-3xl font-black text-slate-800 mt-2">0%</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">No attendance sessions recorded yet.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classes Attended</span>
                  <p className="text-3xl font-black text-slate-800 mt-2">0 / 0</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">No active rosters available.</p>
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
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent-500" />
            Class Schedule
          </h3>
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-600">No scheduled sessions</p>
            <p className="text-xs mt-1">Once faculty initiates roll calls for your section, they will appear here in real-time.</p>
          </div>
        </div>
      )}
    </div>
  );
}
