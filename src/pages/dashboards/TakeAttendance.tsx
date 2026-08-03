import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

interface ClassSlot {
  offering_id: string;
  course_code: string;
  course_name: string;
  section_id: string;
  section_name: string;
  period_number: number;
  timetabled_faculty_name: string;
  timetabled_faculty_id: string;
  status: 'pending' | 'completed' | 'cancelled';
  session_id?: string;
  isSubstitute: boolean;
}

interface StudentRosterItem {
  student_id: string;
  name: string;
  roll_no: string;
  status: 'present' | 'absent';
}

export function TakeAttendance() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const autoOfferingId = searchParams.get('offering_id');
  const autoPeriod = searchParams.get('period');
  
  // Date and view states
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [facultyRow, setFacultyRow] = useState<any | null>(null);
  const [classes, setClasses] = useState<ClassSlot[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active marking state
  const [activeClass, setActiveClass] = useState<ClassSlot | null>(null);
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const getDayName = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()];
  };

  const loadFacultyClasses = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    setClasses([]);

    try {
      // 1. Fetch user's Faculty Row
      const { data: facRow, error: facErr } = await supabase
        .from('faculty')
        .select('id, name')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (facErr) throw facErr;
      if (!facRow) {
        setFacultyRow(null);
        setLoading(false);
        return;
      }
      setFacultyRow(facRow);

      // 2. Fetch Active Term
      const { data: activeTerm } = await supabase
        .from('terms')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (!activeTerm) {
        throw new Error('No active academic term configured.');
      }

      // 3. Fetch all timetable slots matching today's weekday for the current week's Monday
      const dayName = getDayName(selectedDate);
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
      const weekMonday = getCurrentWeekMonday(selectedDate);
      
      console.log('faculty_id being used:', facRow.id);
      console.log('day_of_week string being used:', dayName);
      console.log('week_start_date being used:', weekMonday);

      const { data: timetableSlots, error: ttError } = await supabase
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
            courses!inner (code, name),
            faculty!inner (id, name, profile_id)
          )
        `)
        .eq('course_offerings.faculty.profile_id', user.id)
        .eq('day_of_week', dayName)
        .eq('week_start_date', weekMonday);

      if (ttError) {
        console.error('QUERY FAILED', ttError.message, ttError.details, ttError.hint, ttError.code);
        throw ttError;
      }

      // Filter slots where this faculty teaches, OR check if they are substitute on this date
      const matchedSlots: ClassSlot[] = [];

      // 4. Fetch all sessions recorded for this date (substitutions or suspensions)
      const { data: dateSessions, error: sessError } = await supabase
        .from('sessions')
        .select('id, course_offering_id, period_no, status, marked_by, substitute_for')
        .eq('session_date', selectedDate);

      if (sessError) {
        console.error('QUERY FAILED', sessError.message, sessError.details, sessError.hint, sessError.code);
        throw sessError;
      }

      const sessionMap = new Map<string, any>();
      dateSessions?.forEach(s => {
        sessionMap.set(`${s.course_offering_id}_${s.period_no}`, s);
      });

      // Map timetabled slots
      timetableSlots?.forEach((s: any) => {
        const offering = s.course_offerings;
        if (!offering) return;

        // Check if there is a session override for this slot
        const override = sessionMap.get(`${offering.id}_${s.period_no}`);
        const secName = offering.section_id 
          ? (offering.group_label ? `${offering.sections?.name || ''} (${offering.group_label})` : (offering.sections?.name || ''))
          : (offering.group_label || 'Group Class');
        
        matchedSlots.push({
          offering_id: offering.id,
          course_code: offering.courses?.code || '',
          course_name: offering.courses?.name || '',
          section_id: offering.section_id,
          section_name: secName,
          period_number: s.period_no,
          timetabled_faculty_name: offering.faculty?.name || '',
          timetabled_faculty_id: offering.faculty_id,
          status: override ? override.status : 'pending',
          session_id: override?.id,
          isSubstitute: !!(override && override.substitute_for && override.marked_by === user.id)
        });
      });

      // 5. Check if there are other substitute sessions assigned to me that are NOT in the regular timetable for today
      dateSessions?.forEach(s => {
        if (s.marked_by === user.id) {
          // If not already mapped in matchedSlots
          const alreadyMapped = matchedSlots.some(m => m.offering_id === s.course_offering_id && m.period_number === s.period_no);
          if (!alreadyMapped) {
            // Find course offering details
            const offeringDetails = offerings_cache.find(o => o.id === s.course_offering_id);
            if (offeringDetails) {
              const secName = offeringDetails.section_id 
                ? (offeringDetails.group_label ? (offeringDetails.sections?.name || '') + (offeringDetails.group_label ? ` (${offeringDetails.group_label})` : '') : (offeringDetails.sections?.name || ''))
                : (offeringDetails.group_label || 'Group Class');
              matchedSlots.push({
                offering_id: s.course_offering_id,
                course_code: offeringDetails.courses?.code || '',
                course_name: offeringDetails.courses?.name || '',
                section_id: offeringDetails.section_id,
                section_name: secName,
                period_number: s.period_no,
                timetabled_faculty_name: offeringDetails.faculty?.name || '',
                timetabled_faculty_id: offeringDetails.faculty_id,
                status: s.status,
                session_id: s.id,
                isSubstitute: true
              });
            }
          }
        }
      });

      setClasses(matchedSlots);

      // Auto-select slot from query params if available
      if (autoOfferingId && autoPeriod) {
        const targetPeriod = parseInt(autoPeriod);
        const match = matchedSlots.find(c => c.offering_id === autoOfferingId && c.period_number === targetPeriod);
        if (match) {
          handleMarkClass(match);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while loading schedules.');
    } finally {
      setLoading(false);
    }
  };

  // Helper courses cache for off-timetable substitutions
  const [offerings_cache, setOfferingsCache] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('course_offerings').select(`
      id,
      course_id,
      courses (code, name),
      section_id,
      sections (name),
      faculty_id,
      faculty (name),
      group_label
    `).then(({ data }) => {
      setOfferingsCache(data || []);
    });
  }, []);

  useEffect(() => {
    loadFacultyClasses();
  }, [user, selectedDate, offerings_cache]);

  // Load roster when class is picked
  const handleMarkClass = async (cls: ClassSlot) => {
    setFeedback(null);
    setActiveClass(cls);
    setLoadingRoster(true);

    try {
      // 1. Fetch enrolled students
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          students (id, name, roll_no)
        `)
        .eq('course_offering_id', cls.offering_id);

      const rosterItems: StudentRosterItem[] = (enrollments || []).map((e: any) => ({
        student_id: e.student_id,
        name: e.students?.name || 'N/A',
        roll_no: e.students?.roll_no || 'N/A',
        status: 'present' // default
      }));

      // 2. Fetch existing attendance states (if already marked completed)
      if (cls.session_id) {
        const { data: savedAtt } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('session_id', cls.session_id);

        const savedMap = new Map(savedAtt?.map(a => [a.student_id, a.status]));
        rosterItems.forEach(item => {
          if (savedMap.has(item.student_id)) {
            item.status = savedMap.get(item.student_id) as 'present' | 'absent';
          }
        });
      }

      setRoster(rosterItems);
    } catch (err: any) {
      alert(`Failed to load student roster: ${err.message}`);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Save attendance
  const handleSaveAttendance = async () => {
    if (!activeClass || !user) return;
    setSavingAttendance(true);
    setFeedback(null);

    try {
      // 1. Upsert session entry
      const payload: any = {
        course_offering_id: activeClass.offering_id,
        session_date: selectedDate,
        period_no: activeClass.period_number,
        status: 'completed',
        marked_by: user.id
      };

      if (activeClass.isSubstitute) {
        payload.substitute_for = activeClass.timetabled_faculty_id;
      }

      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .upsert(payload, { onConflict: 'course_offering_id, session_date, period_no' })
        .select('id')
        .single();

      if (sessErr) throw sessErr;

      // 2. Upsert attendance rows
      const attRows = roster.map(item => ({
        session_id: session.id,
        student_id: item.student_id,
        status: item.status
      }));

      const { error: attErr } = await supabase
        .from('attendance')
        .upsert(attRows, { onConflict: 'session_id, student_id' });

      if (attErr) throw attErr;

      setFeedback({ type: 'success', msg: 'Attendance saved successfully.' });
      
      // Update session status in local slot item
      const updatedClasses = classes.map(c => {
        if (c.offering_id === activeClass.offering_id && c.period_number === activeClass.period_number) {
          return { ...c, status: 'completed' as const, session_id: session.id };
        }
        return c;
      });
      setClasses(updatedClasses);
      setActiveClass({ ...activeClass, status: 'completed', session_id: session.id });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Failed to save attendance.' });
    } finally {
      setSavingAttendance(false);
    }
  };

  // Toggle present/absent state
  const toggleStudentStatus = (index: number) => {
    const updated = [...roster];
    updated[index].status = updated[index].status === 'present' ? 'absent' : 'present';
    setRoster(updated);
  };

  // Set all students to present
  const markAllPresent = () => {
    const updated = roster.map(r => ({ ...r, status: 'present' as const }));
    setRoster(updated);
  };

  // Checks 48h editing boundary
  const isEditable = () => {
    const diff = new Date().getTime() - new Date(selectedDate).getTime();
    return diff <= 48 * 60 * 60 * 1000;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  if (!facultyRow) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center max-w-xl mx-auto space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Faculty profile not found</h3>
        <p className="text-slate-500 text-sm">
          Your credentials do not match a faculty staff roster record. Please contact the administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-650" />
          <p>{errorMsg}</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Take Attendance</h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              Select date, view timetabled classes and active substitutions, and mark student roll calls.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Class Selection list */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Marking Date</label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="block w-full p-2.5 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm font-medium"
              />
              <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Classes</h4>
            
            {classes.length === 0 ? (
              <p className="text-xs text-slate-450 italic py-4">No timetabled classes or substitutions scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {classes.map((cls, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleMarkClass(cls)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      activeClass?.offering_id === cls.offering_id && activeClass?.period_number === cls.period_number
                        ? 'border-accent-500 bg-accent-50/30'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800 text-xs">{cls.course_code}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 border text-slate-500 font-bold">{cls.section_name}</span>
                        {cls.isSubstitute && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-250 text-amber-600 font-extrabold">SUB</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold truncate">{cls.course_name}</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>Period {cls.period_number}</span>
                      </div>
                    </div>

                    <div>
                      {cls.status === 'completed' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-250 text-emerald-600 font-bold text-[9px]">MARKED</span>
                      )}
                      {cls.status === 'cancelled' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-50 border border-rose-250 text-rose-600 font-bold text-[9px]">SUSPENDED</span>
                      )}
                      {cls.status === 'pending' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 font-bold text-[9px]">PENDING</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Attendance Marking Viewport */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[350px]">
          {!activeClass ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-20 space-y-2">
              <CheckSquare className="w-12 h-12 text-slate-200" />
              <p>Select a class session from the schedule list to mark roll call.</p>
            </div>
          ) : activeClass.status === 'cancelled' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-20 space-y-3">
              <AlertTriangle className="w-12 h-12 text-rose-400" />
              <h4 className="font-bold text-slate-800 text-sm">Class Suspended</h4>
              <p className="text-center max-w-xs text-slate-500">
                This class session was marked as **Cancelled/Suspended** by the Program Leader. Attendance cannot be recorded.
              </p>
            </div>
          ) : loadingRoster ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Mark Roll Call: <span className="text-accent-600">{activeClass.course_code}</span> ({activeClass.section_name})
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Period {activeClass.period_number} | Timetabled Faculty: {activeClass.timetabled_faculty_name}
                    </p>
                  </div>
                  
                  {isEditable() ? (
                    <button
                      onClick={markAllPresent}
                      className="px-3 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 font-semibold rounded-lg text-[10px] transition-colors"
                    >
                      Mark All Present
                    </button>
                  ) : (
                    <span className="inline-flex px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-600 font-bold text-[9px] gap-1 items-center">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Locked (48h Edit Window Expired)
                    </span>
                  )}
                </div>

                {feedback && (
                  <div className={`p-3 rounded-xl border text-xs flex gap-2 mb-4 ${
                    feedback.type === 'success' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-rose-50 border-rose-250 text-rose-800'
                  }`}>
                    <Info className="w-4 h-4 shrink-0" />
                    <p>{feedback.msg}</p>
                  </div>
                )}

                {roster.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-12">No students enrolled in this course offering.</p>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm max-h-[300px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase sticky top-0 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2">Roll No</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {roster.map((student, idx) => (
                          <tr key={student.student_id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-semibold text-slate-500">{student.roll_no}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{student.name}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                disabled={!isEditable()}
                                onClick={() => toggleStudentStatus(idx)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                  student.status === 'present'
                                    ? 'bg-emerald-50 border-emerald-250 text-emerald-600 hover:bg-emerald-100/50'
                                    : 'bg-rose-50 border-rose-250 text-rose-600 hover:bg-rose-100/50'
                                } disabled:opacity-85`}
                              >
                                {student.status.toUpperCase()}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {isEditable() && roster.length > 0 && (
                <div className="pt-4 border-t border-slate-100 text-right mt-6">
                  <button
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="px-6 py-2.5 bg-accent-600 hover:bg-accent-500 text-white font-semibold text-xs rounded-xl shadow shadow-accent-600/10 flex items-center gap-1.5 transition-colors ml-auto"
                  >
                    {savingAttendance ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Save Attendance
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
