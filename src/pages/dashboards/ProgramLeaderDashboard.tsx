import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Users,
  Layers,
  AlertTriangle,
  Loader2,
  UserCheck,
  Slash,
  BookOpen,
  Info
} from 'lucide-react';

export function ProgramLeaderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // General States
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ batches: 0, sections: 0, students: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Substitution States
  const [subDate, setSubDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [subSlots, setSubSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [allFaculty, setAllFaculty] = useState<any[]>([]);
  const [selectedFacultyProfileId, setSelectedFacultyProfileId] = useState<string>('');
  const [subFeedback, setSubFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [submittingSub, setSubmittingSub] = useState(false);

  // Suspension States
  const [suspDate, setSuspDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [suspMode, setSuspMode] = useState<'slot' | 'section'>('slot');
  const [suspSlots, setSuspSlots] = useState<any[]>([]);
  const [selectedSuspSlotId, setSelectedSuspSlotId] = useState<string>('');
  const [selectedSuspSectionId, setSelectedSuspSectionId] = useState<string>('');
  const [sections, setSections] = useState<any[]>([]);
  const [suspFeedback, setSuspFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [submittingSusp, setSubmittingSusp] = useState(false);

  const getDayName = (dateStr: string): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Active Term
      const { data: termData } = await supabase
        .from('terms')
        .select('id, name')
        .eq('is_active', true)
        .maybeSingle();

      if (!termData) {
        setLoading(false);
        return;
      }

      // 2. Fetch logged-in user's Faculty Row
      const { data: facRow, error: facErr } = await supabase
        .from('faculty')
        .select('id, name')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (facErr) throw facErr;
      if (!facRow) {
        setLoading(false);
        return;
      }

      // 3. Fetch program leader assigned sections
      const { data: assignments } = await supabase
        .from('program_leader_sections')
        .select(`
          section_id,
          sections (id, name, batch_id, batches(admission_year))
        `)
        .eq('faculty_id', facRow.id)
        .eq('term_id', termData.id);

      const sectionList = assignments?.map((a: any) => a.sections).filter(Boolean) || [];
      setSections(sectionList);
      if (sectionList.length > 0) {
        setSelectedSuspSectionId(sectionList[0].id);
      }

      // 4. Scoped stats
      const uniqueBatchIds = Array.from(new Set(sectionList.map((s: any) => s.batch_id)));
      const sectionIds = sectionList.map((s: any) => s.id);
      
      let studentCount = 0;
      if (sectionIds.length > 0) {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .in('section_id', sectionIds);
        studentCount = count ?? 0;
      }

      setStats({
        batches: uniqueBatchIds.length,
        sections: sectionList.length,
        students: studentCount
      });

      // 5. Fetch All Faculty list for substitutions
      const { data: facultyData } = await supabase
        .from('faculty')
        .select('id, name, employee_code, profile_id')
        .order('name');
      
      setAllFaculty(facultyData || []);
      if (facultyData && facultyData.length > 0) {
        const firstWithProfile = facultyData.find(f => f.profile_id);
        setSelectedFacultyProfileId(firstWithProfile?.profile_id || '');
      }

      // 6. Load scheduled classes for substitutions & suspensions based on default date
      await loadSubstitutionSlots(subDate, sectionIds);
      await loadSuspensionSlots(suspDate, sectionIds);

    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while fetching program metrics.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubstitutionSlots = async (dateStr: string, explicitSectionIds?: string[]) => {
    if (!user) return;
    try {
      let sectionIds = explicitSectionIds;
      if (!sectionIds) {
        const { data: activeTerm } = await supabase.from('terms').select('id').eq('is_active', true).maybeSingle();
        const { data: facRow } = await supabase.from('faculty').select('id').eq('profile_id', user?.id).maybeSingle();
        if (activeTerm && facRow) {
          const { data: assignments } = await supabase
            .from('program_leader_sections')
            .select('section_id')
            .eq('faculty_id', facRow.id)
            .eq('term_id', activeTerm.id);
          sectionIds = assignments?.map(a => a.section_id) || [];
        }
      }

      if (!sectionIds || sectionIds.length === 0) {
        setSubSlots([]);
        setSelectedSlotId('');
        return;
      }

      const dayName = getDayName(dateStr);

      const { data: slots } = await supabase
        .from('timetable')
        .select(`
          id,
          day_of_week,
          period_number,
          course_offering_id,
          course_offerings (
            id,
            courses (code, name),
            sections (name),
            faculty (id, name, employee_code)
          )
        `)
        .in('section_id', sectionIds)
        .eq('day_of_week', dayName);

      setSubSlots(slots || []);
      if (slots && slots.length > 0) {
        setSelectedSlotId(slots[0].id);
      } else {
        setSelectedSlotId('');
      }
    } catch (err) {
      console.error('Error loading sub slots:', err);
    }
  };

  const loadSuspensionSlots = async (dateStr: string, explicitSectionIds?: string[]) => {
    if (!user) return;
    try {
      let sectionIds = explicitSectionIds;
      if (!sectionIds) {
        const { data: activeTerm } = await supabase.from('terms').select('id').eq('is_active', true).maybeSingle();
        const { data: facRow } = await supabase.from('faculty').select('id').eq('profile_id', user?.id).maybeSingle();
        if (activeTerm && facRow) {
          const { data: assignments } = await supabase
            .from('program_leader_sections')
            .select('section_id')
            .eq('faculty_id', facRow.id)
            .eq('term_id', activeTerm.id);
          sectionIds = assignments?.map(a => a.section_id) || [];
        }
      }

      if (!sectionIds || sectionIds.length === 0) {
        setSuspSlots([]);
        setSelectedSuspSlotId('');
        return;
      }

      const dayName = getDayName(dateStr);

      const { data: slots } = await supabase
        .from('timetable')
        .select(`
          id,
          day_of_week,
          period_number,
          course_offering_id,
          course_offerings (
            id,
            courses (code, name),
            sections (name),
            faculty (id, name, employee_code)
          )
        `)
        .in('section_id', sectionIds)
        .eq('day_of_week', dayName);

      setSuspSlots(slots || []);
      if (slots && slots.length > 0) {
        setSelectedSuspSlotId(slots[0].id);
      } else {
        setSelectedSuspSlotId('');
      }
    } catch (err) {
      console.error('Error loading suspension slots:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  // Handle Save Substitution
  const handleSaveSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubFeedback(null);
    if (!selectedSlotId || !selectedFacultyProfileId) {
      setSubFeedback({ type: 'error', msg: 'Please select a timetabled class slot and substitute faculty.' });
      return;
    }

    setSubmittingSub(true);
    try {
      // Find offering details from loaded slot list
      const slot = subSlots.find(s => s.id === selectedSlotId);
      if (!slot) throw new Error('Selected slot is invalid.');

      const offering = slot.course_offerings;

      // Check if session row already exists for this date + offering + period
      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .select('id')
        .eq('course_offering_id', slot.course_offering_id)
        .eq('date', subDate)
        .eq('period_number', slot.period_number)
        .maybeSingle();

      if (sessErr) throw sessErr;

      if (session) {
        // Update session row
        const { error: updErr } = await supabase
          .from('sessions')
          .update({
            substitute_for_id: offering.faculty.id,
            marked_by: selectedFacultyProfileId,
            status: 'scheduled'
          })
          .eq('id', session.id);

        if (updErr) throw updErr;
      } else {
        // Insert new session row
        const { error: insErr } = await supabase
          .from('sessions')
          .insert({
            course_offering_id: slot.course_offering_id,
            date: subDate,
            period_number: slot.period_number,
            status: 'scheduled',
            marked_by: selectedFacultyProfileId,
            substitute_for_id: offering.faculty.id
          });

        if (insErr) throw insErr;
      }

      setSubFeedback({ type: 'success', msg: 'Substitution assigned successfully for this session date.' });
    } catch (err: any) {
      setSubFeedback({ type: 'error', msg: err.message || 'Substitution assignment failed.' });
    } finally {
      setSubmittingSub(false);
    }
  };

  // Handle Save Suspension
  const handleSaveSuspension = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspFeedback(null);
    setSubmittingSusp(true);

    try {
      if (suspMode === 'slot') {
        if (!selectedSuspSlotId) throw new Error('Please select a timetable class to suspend.');
        const slot = suspSlots.find(s => s.id === selectedSuspSlotId);
        if (!slot) throw new Error('Selected slot is invalid.');

        // Get session row or create one marked as cancelled
        const { data: session } = await supabase
          .from('sessions')
          .select('id')
          .eq('course_offering_id', slot.course_offering_id)
          .eq('date', suspDate)
          .eq('period_number', slot.period_number)
          .maybeSingle();

        if (session) {
          // Update status to cancelled and delete attendance records
          await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', session.id);
          await supabase.from('attendance').delete().eq('session_id', session.id);
        } else {
          // Create cancelled session
          await supabase.from('sessions').insert({
            course_offering_id: slot.course_offering_id,
            date: suspDate,
            period_number: slot.period_number,
            status: 'cancelled'
          });
        }
        setSuspFeedback({ type: 'success', msg: 'Class suspended successfully. Attendance metrics will skip this session.' });
      } else {
        if (!selectedSuspSectionId) throw new Error('Please select a section to suspend.');
        
        // Fetch all timetable slots for section on selected weekday
        const dayName = getDayName(suspDate);
        const { data: secSlots } = await supabase
          .from('timetable')
          .select('course_offering_id, period_number')
          .eq('section_id', selectedSuspSectionId)
          .eq('day_of_week', dayName);

        if (!secSlots || secSlots.length === 0) {
          throw new Error(`No scheduled classes found for this section on ${dayName}.`);
        }

        for (const slot of secSlots) {
          const { data: session } = await supabase
            .from('sessions')
            .select('id')
            .eq('course_offering_id', slot.course_offering_id)
            .eq('date', suspDate)
            .eq('period_number', slot.period_number)
            .maybeSingle();

          if (session) {
            await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', session.id);
            await supabase.from('attendance').delete().eq('session_id', session.id);
          } else {
            await supabase.from('sessions').insert({
              course_offering_id: slot.course_offering_id,
              date: suspDate,
              period_number: slot.period_number,
              status: 'cancelled'
            });
          }
        }
        setSuspFeedback({ type: 'success', msg: `Successfully suspended all (${secSlots.length}) classes for the selected section today.` });
      }
    } catch (err: any) {
      setSuspFeedback({ type: 'error', msg: err.message || 'Suspension failed.' });
    } finally {
      setSubmittingSusp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[450px]">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center max-w-xl mx-auto space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">No Sections Assigned</h3>
        <p className="text-slate-500 text-sm">
          Your Program Leader profile is not linked to any academic sections. Please contact the administrator.
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
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Program Leader Overview</h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              Track compliance, assign substitutions, schedule suspended sessions, and verify student performance for your assigned sections.
            </p>
          </div>
          <button
            onClick={() => navigate('/pl/timetable')}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Manage Timetables
          </button>
        </div>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: 'Program Batches', value: stats.batches, icon: CalendarIcon, color: 'text-indigo-500 bg-indigo-50 border-indigo-100' },
          { name: 'Class Sections', value: stats.sections, icon: Layers, color: 'text-cyan-500 bg-cyan-50 border-cyan-100' },
          { name: 'Assigned Students', value: stats.students, icon: Users, color: 'text-emerald-500 bg-emerald-50 border-emerald-100' },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.name}</span>
                <p className="text-2xl font-extrabold text-slate-800 mt-2">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl border ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Panel: Substitutions and Suspensions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Assign Substitutes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <form onSubmit={handleSaveSubstitution} className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Assign Substitution</h3>
              <p className="text-xs text-slate-400 mt-1">Assign an alternate faculty member to cover a timetabled class session.</p>
            </div>

            {subFeedback && (
              <div className={`p-3.5 rounded-xl border text-xs flex gap-2 ${
                subFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <Info className="w-4 h-4 shrink-0" />
                <p>{subFeedback.msg}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Pick Date</label>
                <input
                  type="date"
                  value={subDate}
                  onChange={(e) => {
                    setSubDate(e.target.value);
                    loadSubstitutionSlots(e.target.value);
                  }}
                  className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Scheduled class</label>
                <select
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                >
                  <option value="">-- Select timetabled class --</option>
                  {subSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      [{slot.course_offerings?.courses?.code}] {slot.course_offerings?.sections?.name} - Period {slot.period_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Substitute Faculty</label>
              <select
                value={selectedFacultyProfileId}
                onChange={(e) => setSelectedFacultyProfileId(e.target.value)}
                className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
              >
                <option value="">-- Select substitute teacher --</option>
                {allFaculty.filter(f => f.profile_id).map((f) => (
                  <option key={f.id} value={f.profile_id}>
                    {f.name} ({f.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingSub || !selectedSlotId}
              className="px-6 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold text-xs tracking-wide shadow flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {submittingSub ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              Assign Substitute
            </button>
          </form>
        </div>

        {/* Suspend Class */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <form onSubmit={handleSaveSuspension} className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Suspend Class / Day</h3>
              <p className="text-xs text-slate-400 mt-1">Suspend a specific timetabled class slot or cancel a whole day for a section.</p>
            </div>

            {suspFeedback && (
              <div className={`p-3.5 rounded-xl border text-xs flex gap-2 ${
                suspFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <Info className="w-4 h-4 shrink-0" />
                <p>{suspFeedback.msg}</p>
              </div>
            )}

            <div className="flex border-b border-slate-200 gap-4 mb-2">
              <button
                type="button"
                onClick={() => setSuspMode('slot')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 ${
                  suspMode === 'slot' ? 'border-accent-500 text-accent-600' : 'border-transparent text-slate-400'
                }`}
              >
                Single Class Slot
              </button>
              <button
                type="button"
                onClick={() => setSuspMode('section')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 ${
                  suspMode === 'section' ? 'border-accent-500 text-accent-600' : 'border-transparent text-slate-400'
                }`}
              >
                Whole Day (Section)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Pick Date</label>
                <input
                  type="date"
                  value={suspDate}
                  onChange={(e) => {
                    setSuspDate(e.target.value);
                    loadSuspensionSlots(e.target.value);
                  }}
                  className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm font-medium"
                />
              </div>

              {suspMode === 'slot' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select class</label>
                  <select
                    value={selectedSuspSlotId}
                    onChange={(e) => setSelectedSuspSlotId(e.target.value)}
                    className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                  >
                    <option value="">-- Select timetabled class --</option>
                    {suspSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        [{slot.course_offerings?.courses?.code}] {slot.course_offerings?.sections?.name} - Period {slot.period_number}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Section</label>
                  <select
                    value={selectedSuspSectionId}
                    onChange={(e) => setSelectedSuspSectionId(e.target.value)}
                    className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submittingSusp || (suspMode === 'slot' && !selectedSuspSlotId) || (suspMode === 'section' && !selectedSuspSectionId)}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wide shadow flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {submittingSusp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Slash className="w-4 h-4" />
              )}
              Suspend Class Day
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
