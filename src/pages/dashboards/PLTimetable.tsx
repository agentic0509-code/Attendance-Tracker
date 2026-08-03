import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  Upload,
  Plus,
  Trash,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Table,
  Info,
  Grid
} from 'lucide-react';

interface DraftRow {
  sectionName: string;
  courseCode: string;
  dayOfWeek: string;
  periodNumber: number;
  groupLabel?: string;
  offeringId?: string;
  weekStartDate?: string;
}

interface TimetableSlot {
  day_of_week: string;
  period_number: number;
  section_name: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
}

export function PLTimetable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTerm, setActiveTerm] = useState<{ id: string; name: string } | null>(null);

  // Data lists
  const [sections, setSections] = useState<Array<{ id: string; name: string }>>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [selectedSectionGrid, setSelectedSectionGrid] = useState<string>('');

  // Week-aware States
  const getCurrentWeekMonday = (dStr?: string) => {
    const d = dStr ? new Date(dStr) : new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekMonday());
  const [weeksList, setWeeksList] = useState<string[]>([]);

  // CSV/PDF parsing states
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic PDF script loader
  const loadPdfJS = () => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF library'));
      document.head.appendChild(script);
    });
  };

  const loadInitialData = async () => {
    if (!user) return;
    setLoading(true);
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
      setActiveTerm(termData);

      // 2. Fetch logged-in user's Faculty Row
      const { data: myFaculty } = await supabase
        .from('faculty')
        .select('id, name')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!myFaculty) {
        setLoading(false);
        return;
      }

      // 3. Fetch program leader assigned sections
      const { data: assignments } = await supabase
        .from('program_leader_sections')
        .select(`
          section_id,
          sections (id, name)
        `)
        .eq('faculty_id', myFaculty.id)
        .eq('term_id', termData.id);

      const sectionList = assignments?.map((a: any) => a.sections).filter(Boolean) || [];
      setSections(sectionList);
      
      if (sectionList.length > 0) {
        setSelectedSectionGrid(sectionList[0].name);
      }

      // 4. Fetch Course Offerings for these assigned sections + term electives
      const sectionIds = sectionList.map(s => s.id);
      if (sectionIds.length > 0) {
        const { data: offeringsData } = await supabase
          .from('course_offerings')
          .select(`
            id,
            course_id,
            courses (code, name, department_id),
            section_id,
            sections (name),
            faculty_id,
            faculty (name, employee_code),
            group_label
          `)
          .eq('term_id', termData.id);

        const filteredOfferings = (offeringsData || []).filter(o => 
          (o.section_id && sectionIds.includes(o.section_id)) || 
          (!o.section_id && o.group_label)
        );
        setOfferings(filteredOfferings);
        
        // 5. Fetch Saved Timetable Grid for these sections
        await fetchTimetable(sectionIds);
      } else {
        setOfferings([]);
        setTimetableSlots([]);
      }

    } catch (err: any) {
      console.error('Error loading PL initial details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimetable = async (sectionIds: string[]) => {
    if (sectionIds.length === 0) return;
    try {
      // Fetch distinct week start dates from timetable to populate the dropdown filter
      const { data: distinctWeeks } = await supabase
        .from('timetable')
        .select('week_start_date');

      const rawWeeks = (distinctWeeks || []).map(w => w.week_start_date).filter(Boolean);
      const curWeek = getCurrentWeekMonday();
      if (!rawWeeks.includes(curWeek)) {
        rawWeeks.push(curWeek);
      }
      const sortedWeeks = Array.from(new Set(rawWeeks)).sort().reverse();
      setWeeksList(sortedWeeks);

      const { data: slots, error } = await supabase
        .from('timetable')
        .select(`
          day_of_week,
          period_no,
          course_offering_id,
          course_offerings (
            section_id,
            sections (name),
            courses (code, name),
            faculty (name),
            group_label
          )
        `)
        .eq('week_start_date', selectedWeek);

      if (error) throw error;

      // Fetch student enrollments for these sections to map elective slots
      const { data: sectionStudentEnrolls } = await supabase
        .from('enrollments')
        .select(`
          course_offering_id,
          students!inner (
            section_id
          )
        `)
        .in('students.section_id', sectionIds);

      const mapped: TimetableSlot[] = [];

      (slots || []).forEach((s: any) => {
        const offering = s.course_offerings;
        if (!offering) return;

        if (offering.section_id) {
          if (sectionIds.includes(offering.section_id)) {
            mapped.push({
              day_of_week: s.day_of_week,
              period_number: s.period_no,
              section_name: offering.sections?.name || 'N/A',
              course_code: offering.courses?.code || 'N/A',
              course_name: offering.group_label 
                ? `${offering.courses?.name} (${offering.group_label})`
                : (offering.courses?.name || 'N/A'),
              faculty_name: offering.faculty?.name || 'N/A'
            });
          }
        } else if (offering.group_label) {
          // Find which sections have student enrollments in this elective
          const sectionsWithEnrollments = Array.from(new Set(
            (sectionStudentEnrolls || [])
              .filter((e: any) => e.course_offering_id === s.course_offering_id)
              .map((e: any) => {
                const sec = sections.find(secObj => secObj.id === e.students?.section_id);
                return sec?.name;
              })
              .filter(Boolean)
          ));

          sectionsWithEnrollments.forEach((secName: any) => {
            mapped.push({
              day_of_week: s.day_of_week,
              period_number: s.period_no,
              section_name: secName,
              course_code: offering.courses?.code || 'N/A',
              course_name: `${offering.courses?.name} (${offering.group_label})`,
              faculty_name: offering.faculty?.name || 'N/A'
            });
          });
        }
      });

      setTimetableSlots(mapped);
    } catch (err) {
      console.error('Error fetching timetable slots:', err);
    }
  };

  const handleDeleteSlot = async (slot: TimetableSlot) => {
    if (!window.confirm(`Are you sure you want to delete the scheduled slot for ${slot.course_code} on ${slot.day_of_week} at Period ${slot.period_number}?`)) {
      return;
    }
    try {
      // Find course offering
      const offering = offerings.find(
        o => o.courses.code.toLowerCase() === slot.course_code.toLowerCase() &&
             (o.sections?.name.toLowerCase() === slot.section_name.toLowerCase() ||
              o.group_label?.toLowerCase() === slot.section_name.toLowerCase())
      );
      if (!offering) throw new Error('No matching offering found for deletion.');

      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('course_offering_id', offering.id)
        .eq('day_of_week', slot.day_of_week)
        .eq('period_no', slot.period_number)
        .eq('week_start_date', selectedWeek);

      if (error) throw error;

      // Reload
      const sectionIds = sections.map(s => s.id);
      await fetchTimetable(sectionIds);
    } catch (err: any) {
      alert(err.message || 'Failed to delete slot.');
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [user]);

  useEffect(() => {
    if (sections.length > 0) {
      fetchTimetable(sections.map(s => s.id));
    }
  }, [selectedWeek]);

  // Handle CSV Parsing
  const parseCSV = (text: string) => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === '\n' && !inQuotes) {
        lines.push(currentLine);
        currentLine = '';
      } else if (char === '\r' && !inQuotes) {
        // ignore CR
      } else {
        currentLine += char;
      }
    }
    if (currentLine) lines.push(currentLine);

    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const results: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values: string[] = [];
      let currentValue = '';
      let lineInQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          lineInQuotes = !lineInQuotes;
        } else if (char === ',' && !lineInQuotes) {
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ''));

      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });
      results.push(rowObj);
    }
    return results;
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParsingError(null);
    setValidationErrors([]);
    setSaveSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          throw new Error('No rows found in CSV.');
        }

        const headers = Object.keys(rows[0]).map(h => h.trim().toLowerCase());
        const requiredHeaders = ['section_name', 'course_code', 'group_label', 'day', 'period', 'term_name', 'week_start_date'];
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          throw new Error(`Missing required headers: ${missing.join(', ')}`);
        }

        const mapped: DraftRow[] = rows.map((r: any) => {
          const getVal = (key: string) => {
            const actualKey = Object.keys(r).find(k => k.trim().toLowerCase() === key);
            return actualKey ? r[actualKey]?.trim() : '';
          };

          return {
            sectionName: getVal('section_name'),
            courseCode: getVal('course_code'),
            groupLabel: getVal('group_label'),
            dayOfWeek: getVal('day'),
            periodNumber: parseInt(getVal('period')) || 1,
            weekStartDate: getVal('week_start_date') || getCurrentWeekMonday()
          };
        });

        setDraftRows(mapped);
      } catch (err: any) {
        setParsingError(err.message || 'Error occurred during CSV parsing.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  // Handle PDF Parsing
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParsingError(null);
    setValidationErrors([]);
    setSaveSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      await loadPdfJS();
      const pdfjs = (window as any).pdfjsLib;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let parsedText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const strings = textContent.items.map((item: any) => item.str);
        parsedText += strings.join(' ') + '\n';
      }

      // Simple heuristic timetable regex parsing:
      // Look for days, period numbers, course codes, and section codes
      const parsedRows: DraftRow[] = [];
      const lines = parsedText.split('\n');

      const dayKeywords = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      // Load course codes & section codes dynamically from state caches to match
      const cCodes = offerings.map(o => o.courses.code.toLowerCase());
      const sNames = sections.map(s => s.name.toLowerCase());

      lines.forEach((line) => {
        // Look for tokens matching day, period, course code, and section
        const words = line.split(/\s+/);
        
        let foundDay = 'Monday';
        let foundPeriod = 1;
        let foundSection = '';
        let foundCourse = '';

        words.forEach(word => {
          const w = word.trim().replace(/[,.:;]/g, '');
          const wLower = w.toLowerCase();

          // Match Day
          const matchDay = dayKeywords.find(d => d.toLowerCase() === wLower);
          if (matchDay) foundDay = matchDay;

          // Match Period
          const pVal = parseInt(w);
          if (pVal >= 1 && pVal <= 8) foundPeriod = pVal;

          // Match Section
          const matchSec = sNames.find(s => s === wLower);
          if (matchSec) {
            const actualSec = sections.find(s => s.name.toLowerCase() === wLower);
            if (actualSec) foundSection = actualSec.name;
          }

          // Match Course code
          const matchCourse = cCodes.find(c => c === wLower);
          if (matchCourse) {
            const actualCourse = offerings.find(o => o.courses.code.toLowerCase() === wLower);
            if (actualCourse) foundCourse = actualCourse.courses.code;
          }
        });

        if (foundSection && foundCourse) {
          // Verify duplicate draft row
          const exists = parsedRows.some(
            r => r.sectionName === foundSection && 
                 r.dayOfWeek === foundDay && 
                 r.periodNumber === foundPeriod
          );
          if (!exists) {
            parsedRows.push({
              sectionName: foundSection,
              courseCode: foundCourse,
              dayOfWeek: foundDay,
              periodNumber: foundPeriod,
              weekStartDate: selectedWeek
            });
          }
        }
      });

      if (parsedRows.length === 0) {
        throw new Error('Could not automatically parse timetable grid. Please check file formatting or input rows manually below.');
      }

      setDraftRows(parsedRows);
    } catch (err: any) {
      setParsingError(err.message || 'Error occurred during PDF reading.');
    } finally {
      setIsParsing(false);
    }
  };

  // Add empty manual row
  const addDraftRow = () => {
    const defaultOffering = offerings[0];
    setDraftRows([
      ...draftRows,
      {
        offeringId: defaultOffering?.id || '',
        sectionName: defaultOffering?.sections?.name || '',
        courseCode: defaultOffering?.courses?.code || '',
        groupLabel: defaultOffering?.group_label || '',
        dayOfWeek: 'Monday',
        periodNumber: 1,
        weekStartDate: selectedWeek
      }
    ]);
  };

  const handleSelectOfferingForDraft = (index: number, offeringId: string) => {
    const o = offerings.find(x => x.id === offeringId);
    if (!o) return;
    const updated = [...draftRows];
    updated[index] = {
      ...updated[index],
      offeringId: o.id,
      courseCode: o.courses.code,
      sectionName: o.sections?.name || '',
      groupLabel: o.group_label || ''
    };
    setDraftRows(updated);
  };

  // Delete draft row
  const removeDraftRow = (index: number) => {
    const updated = [...draftRows];
    updated.splice(index, 1);
    setDraftRows(updated);
  };

  // Update cell in draft row
  const updateDraftCell = (index: number, field: keyof DraftRow, value: any) => {
    const updated = [...draftRows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setDraftRows(updated);
  };

  // Validate draft rows and save
  const handleSaveTimetable = async () => {
    setValidationErrors([]);
    setSaveSuccess(null);
    setIsSaving(true);

    try {
      const errors: string[] = [];
      const resolvedSlots: Array<{
        course_offering_id: string;
        section_id: string | null;
        day_of_week: string;
        period_no: number;
        week_start_date: string;
      }> = [];

      // Outer loop to resolve row-by-row
      for (let i = 0; i < draftRows.length; i++) {
        const row = draftRows[i];
        const rowNum = i + 1;

        const rowSecName = (row.sectionName || '').trim();
        const rowCourseCode = (row.courseCode || '').trim().toLowerCase();
        const rowGroupLabel = (row.groupLabel || '').trim();

        let offering = null;
        let secId = null;

        if (!rowGroupLabel) {
          // rule 1: if group_label is blank -> the offering with that section_name and NO group_label
          const sec = sections.find(s => s.name.toLowerCase() === rowSecName.toLowerCase());
          if (sec) {
            secId = sec.id;
            offering = offerings.find(
              o => o.courses.code.toLowerCase() === rowCourseCode &&
                   o.section_id === sec.id &&
                   !o.group_label
            );
          }
        } else if (rowGroupLabel && rowSecName) {
          // rule 2: if group_label is set + section_name present -> offering with that section AND that group_label (labs)
          const sec = sections.find(s => s.name.toLowerCase() === rowSecName.toLowerCase());
          if (sec) {
            secId = sec.id;
            offering = offerings.find(
              o => o.courses.code.toLowerCase() === rowCourseCode &&
                   o.section_id === sec.id &&
                   o.group_label &&
                   o.group_label.toLowerCase() === rowGroupLabel.toLowerCase()
            );
          }
        } else if (rowGroupLabel && !rowSecName) {
          // rule 3: if group_label is set + section_name blank -> offering with that group_label and null section (electives)
          offering = offerings.find(
            o => o.courses.code.toLowerCase() === rowCourseCode &&
                 !o.section_id &&
                 o.group_label &&
                 o.group_label.toLowerCase() === rowGroupLabel.toLowerCase()
          );
        }

        if (!offering) {
          errors.push(`Row ${rowNum}: No matching Course Offering found for Course '${row.courseCode}', Section '${row.sectionName || '(None)'}', Group '${row.groupLabel || '(None)'}'.`);
          continue;
        }

        resolvedSlots.push({
          course_offering_id: offering.id,
          day_of_week: row.dayOfWeek,
          period_no: row.periodNumber,
          section_id: secId,
          week_start_date: row.weekStartDate || selectedWeek
        });
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        setIsSaving(false);
        return;
      }

      // Check unique constraint within resolved list
      const seen = new Set<string>();
      for (let i = 0; i < resolvedSlots.length; i++) {
        const s = resolvedSlots[i];
        const key = `${s.section_id || 'elective'}_${s.week_start_date}_${s.day_of_week}_${s.period_no}`;
        if (seen.has(key)) {
          errors.push(`Row ${i + 1}: Multiple classes scheduled for ${s.section_id ? 'section' : 'elective group'} on week starting ${s.week_start_date}, ${s.day_of_week} at Period ${s.period_no}.`);
        }
        seen.add(key);
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        setIsSaving(false);
        return;
      }

      // Scoped delete: delete existing slots for the affected weeks and PL's own assigned sections/saved electives
      const affectedWeeks = Array.from(new Set(resolvedSlots.map(s => s.week_start_date)));
      const deleteOfferingIds = new Set<string>();

      const assignedSectionIds = sections.map(s => s.id);
      offerings
        .filter(o => o.section_id && assignedSectionIds.includes(o.section_id))
        .forEach(o => deleteOfferingIds.add(o.id));

      resolvedSlots
        .filter(s => !s.section_id)
        .forEach(s => deleteOfferingIds.add(s.course_offering_id));

      const deleteOfferingIdsArray = Array.from(deleteOfferingIds);
      if (deleteOfferingIdsArray.length > 0 && affectedWeeks.length > 0) {
        const { error: delError } = await supabase
          .from('timetable')
          .delete()
          .in('course_offering_id', deleteOfferingIdsArray)
          .in('week_start_date', affectedWeeks);

        if (delError) throw delError;
      }

      // Insert fresh slots mapping to columns
      const insertPayload = resolvedSlots.map(s => ({
        course_offering_id: s.course_offering_id,
        day_of_week: s.day_of_week,
        period_no: s.period_no,
        week_start_date: s.week_start_date
      }));

      const { error: insError } = await supabase.from('timetable').insert(insertPayload);
      if (insError) throw insError;

      setSaveSuccess(`Successfully updated academic timetables.`);
      setDraftRows([]);
      
      // Reload stats
      const sectionIds = sections.map(s => s.id);
      await fetchTimetable(sectionIds);
    } catch (err: any) {
      setValidationErrors([err.message || 'Error occurred while saving timetable slots.']);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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

  // Filter timetable slots matching selected section
  const sectionGridSlots = timetableSlots.filter(s => s.section_name === selectedSectionGrid);
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

  const getGridCell = (day: string, period: number) => {
    return sectionGridSlots.find(s => s.day_of_week === day && s.period_number === period);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">Timetable Editor</h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              Publish structured timetables for sections. Upload a schedule PDF, edit cells dynamically, and confirm allocations.
            </p>
          </div>
          {activeTerm && (
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Term</span>
              <p className="text-sm font-extrabold text-white mt-1">{activeTerm.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-accent-600" />
            <h3 className="font-bold text-slate-800 text-sm">Timetabled Classes View</h3>
          </div>
          {sections.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Select Week:</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="p-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {weeksList.map(w => (
                    <option key={w} value={w}>Week of {w}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Select Section:</label>
                <select
                  value={selectedSectionGrid}
                  onChange={(e) => setSelectedSectionGrid(e.target.value)}
                  className="p-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {sections.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Calendar Grid Matrix */}
        {sections.length === 0 ? (
          <div className="text-center p-6 text-slate-400 text-xs font-semibold">
            No sections found in your department to schedule.
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
                      return (
                        <td key={period} className="px-4 py-4 text-center min-w-[130px] border-r border-slate-50">
                           {slot ? (
                            <div className="p-2.5 rounded-xl bg-accent-50/50 border border-accent-100/50 space-y-1 relative group">
                              <button
                                onClick={() => handleDeleteSlot(slot)}
                                className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-55 hover:bg-rose-100 border border-rose-200 text-rose-500 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow"
                                title="Delete Slot"
                              >
                                <Trash className="w-2.5 h-2.5" />
                              </button>
                              <p className="font-extrabold text-accent-700 text-[11px]">{slot.course_code}</p>
                              <p className="text-[10px] text-slate-500 font-semibold truncate" title={slot.course_name}>{slot.course_name}</p>
                              <p className="text-[9px] text-slate-400 font-medium">{slot.faculty_name}</p>
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

      {/* TIMETABLE LOADER & PARSER EDITOR CONSOLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PDF Uploader Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">1. Import Timetable Schedule</h3>
          <p className="text-xs text-slate-400">
            Import timetable entries using a schedule PDF or a CSV file containing headers: <code className="bg-slate-50 px-1 py-0.5 border rounded text-[10px] font-mono">section_name, course_code, day, period, term_name</code>.
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* PDF Selector */}
            <label className="flex flex-col items-center justify-center w-full h-24 border border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-650">Upload Schedule PDF</span>
              </div>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                disabled={isParsing}
                onChange={handlePdfUpload}
              />
            </label>

            {/* CSV Selector */}
            <label className="flex flex-col items-center justify-center w-full h-24 border border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-650">Import Timetable CSV</span>
              </div>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={isParsing}
                onChange={handleCsvUpload}
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              onClick={addDraftRow}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Manual Add Slot Row
            </button>
          </div>
        </div>

        {/* Draft Edit Review Table card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">2. Timetable Draft Review Grid</h3>
              <span className="text-[10px] text-slate-400 uppercase font-mono">({draftRows.length} draft records)</span>
            </div>

            {parsingError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-250 rounded-xl text-rose-800 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <p>{parsingError}</p>
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="p-4 mb-4 bg-rose-50 border border-rose-250 rounded-xl text-rose-800 text-xs space-y-1.5 max-h-[160px] overflow-y-auto">
                <h4 className="font-bold text-rose-900">Validation Errors:</h4>
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {saveSuccess && (
              <div className="p-4 mb-4 bg-emerald-50 border border-emerald-250 rounded-xl text-emerald-800 text-xs flex gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <p>{saveSuccess}</p>
              </div>
            )}

            {draftRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs space-y-2">
                <Grid className="w-10 h-10 text-slate-200" />
                <p>No draft slots loaded. Upload a PDF or click "Manual Add Slot Row" to begin scheduling.</p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm max-h-[250px] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-2">Class Offering</th>
                      <th className="px-3 py-2 w-[110px]">Week Monday</th>
                      <th className="px-3 py-2 w-[90px]">Day</th>
                      <th className="px-3 py-2 w-[90px]">Period</th>
                      <th className="px-3 py-2 text-center w-[85px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {draftRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-2 py-1.5">
                          <select
                            value={row.offeringId || offerings.find(o => o.courses.code.toLowerCase() === row.courseCode.toLowerCase() && ((o.sections?.name || '').toLowerCase() === (row.sectionName || '').toLowerCase() || (o.group_label || '').toLowerCase() === (row.groupLabel || '').toLowerCase()))?.id || ''}
                            onChange={(e) => handleSelectOfferingForDraft(idx, e.target.value)}
                            className="w-full p-1 border border-slate-200 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-accent-500 font-semibold"
                          >
                            <option value="">-- Match Offering --</option>
                            {offerings.map(o => {
                              const label = o.section_id && o.group_label
                                ? `${o.courses.name} — ${o.sections.name} (${o.group_label})`
                                : !o.section_id && o.group_label
                                  ? `${o.courses.name} — ${o.group_label}`
                                  : `${o.courses.name} — ${o.sections.name}`;
                              return (
                                <option key={o.id} value={o.id}>{label}</option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            value={row.weekStartDate || selectedWeek}
                            onChange={(e) => updateDraftCell(idx, 'weekStartDate', e.target.value)}
                            className="w-full p-0.5 border border-slate-200 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-accent-500 font-semibold text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.dayOfWeek}
                            onChange={(e) => updateDraftCell(idx, 'dayOfWeek', e.target.value)}
                            className="w-full p-1 border border-slate-200 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-accent-500 font-semibold"
                          >
                            {weekdays.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.periodNumber}
                            onChange={(e) => updateDraftCell(idx, 'periodNumber', parseInt(e.target.value))}
                            className="w-full p-1 border border-slate-200 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-accent-500 font-semibold"
                          >
                            {periods.map(p => (
                              <option key={p} value={p}>Period {p}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removeDraftRow(idx)}
                            className="p-1 rounded hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-colors"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {draftRows.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>Confirming delete-recreates existing timetable allocations for these sections.</span>
              </div>
              <button
                onClick={handleSaveTimetable}
                disabled={isSaving}
                className="px-6 py-2 bg-accent-600 hover:bg-accent-500 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1 transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Timetable...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Save Grid
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
