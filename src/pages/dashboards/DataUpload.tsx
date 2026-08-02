import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Upload,
  Plus,
  AlertTriangle,
  CheckCircle,
  Database,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Building2,
  Users,
  GraduationCap,
  BookOpen
} from 'lucide-react';

// RFC-4180 compliant CSV parser
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(current.trim());
      if (row.length > 1 || row[0] !== '') {
        result.push(row);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current !== '' || row.length > 0) {
    row.push(current.trim());
    result.push(row);
  }
  return result;
}

type EntityType =
  | 'departments'
  | 'terms'
  | 'batches'
  | 'sections'
  | 'faculty'
  | 'students'
  | 'courses'
  | 'course_offerings'
  | 'enrollments';

interface RowStatus {
  rowNum: number;
  data: string[];
  status: 'pending' | 'valid' | 'invalid' | 'success' | 'duplicate' | 'error';
  reason?: string;
}

export function DataUpload() {
  const [activeTab, setActiveTab] = useState<'structural' | 'academic'>('structural');
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('departments');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // CSV Preview & Validation states
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RowStatus[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{
    inserted: number;
    duplicate: number;
    failed: number;
    total: number;
  } | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // Single Manual Form states
  const [manualDept, setManualDept] = useState({ code: '', name: '' });
  const [manualTerm, setManualTerm] = useState({
    name: '',
    academic_year: '',
    semester_number: 1,
    start_date: '',
    end_date: '',
    is_active: false,
  });
  const [manualBatch, setManualBatch] = useState({
    department_code: '',
    admission_year: new Date().getFullYear(),
    current_semester: 1,
  });
  const [manualSection, setManualSection] = useState({
    department_code: '',
    admission_year: new Date().getFullYear(),
    section_name: '',
  });

  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Schema configs
  const expectedHeaders: Record<EntityType, string[]> = {
    departments: ['code', 'name'],
    terms: ['name', 'academic_year', 'semester_number', 'start_date', 'end_date', 'is_active'],
    batches: ['department_code', 'admission_year', 'current_semester'],
    sections: ['department_code', 'admission_year', 'section_name'],
    faculty: ['employee_code', 'name', 'email', 'department_code', 'phone', 'role'],
    students: ['roll_no', 'admission_no', 'name', 'section_name', 'personal_email', 'official_email', 'dob', 'gender', 'phone'],
    courses: ['code', 'name', 'credits', 'course_type', 'semester_number', 'department_code'],
    course_offerings: ['course_code', 'section_name', 'faculty_code', 'term_name'],
    enrollments: ['student roll number', 'course code', 'section name', 'term name'],
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, entity: EntityType) => {
    setSelectedEntity(entity);
    setGlobalError(null);
    setUploadSummary(null);
    setIsValidated(false);
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          throw new Error('CSV file is empty');
        }
        
        const fileHeaders = parsed[0].map(h => h.toLowerCase());
        const expected = expectedHeaders[entity];
        
        // Validate required headers exist
        const missing = expected.filter(h => !fileHeaders.includes(h));
        if (missing.length > 0) {
          setGlobalError(`Missing required headers: ${missing.join(', ')}`);
          setHeaders([]);
          setRows([]);
          return;
        }

        setHeaders(parsed[0]);
        
        // Map raw lines into RowStatus structures (skipping header)
        const rowStatuses: RowStatus[] = parsed.slice(1).map((line, idx) => ({
          rowNum: idx + 2, // 1-indexed header is row 1
          data: line,
          status: 'pending'
        }));
        
        setRows(rowStatuses);
      } catch (err: any) {
        setGlobalError(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Perform validation checking DB relations
  const validateRows = async () => {
    setGlobalError(null);
    setIsValidated(false);
    
    try {
      // 1. Fetch DB caches
      const { data: depts } = await supabase.from('departments').select('id, code');
      const { data: terms } = await supabase.from('terms').select('id, name');
      const { data: batches } = await supabase.from('batches').select('id, department_id, admission_year');
      const { data: sections } = await supabase.from('sections').select('id, name, batch_id');
      const { data: faculty } = await supabase.from('faculty').select('id, employee_code');
      const { data: students } = await supabase.from('students').select('id, roll_no');
      const { data: offerings } = await supabase.from('course_offerings').select('id, course_id, section_id, term_id');
      const { data: courses } = await supabase.from('courses').select('id, code');

      const deptMap = new Map(depts?.map(d => [d.code.toLowerCase(), d.id]));
      const termMap = new Map(terms?.map(t => [t.name.toLowerCase(), t.id]));
      const facMap = new Map(faculty?.map(f => [f.employee_code.toLowerCase(), f.id]));
      const studMap = new Map(students?.map(s => [s.roll_no.toLowerCase(), s.id]));
      const courseMap = new Map(courses?.map(c => [c.code.toLowerCase(), c.id]));
      const secMap = new Map(sections?.map(s => [s.name.toLowerCase(), s.id]));

      // Helper map for batches (composite key: dept_uuid + admission_year)
      const batchMap = new Map<string, string>();
      batches?.forEach(b => {
        batchMap.set(`${b.department_id}_${b.admission_year}`, b.id);
      });

      const updatedRows = [...rows];
      const fileHeaders = headers.map(h => h.toLowerCase());

      for (let i = 0; i < updatedRows.length; i++) {
        const row = updatedRows[i];
        const line = row.data;
        
        // Helper to grab cell value by header name
        const getVal = (headerName: string) => {
          const idx = fileHeaders.indexOf(headerName);
          return idx !== -1 ? line[idx]?.trim() : '';
        };

        let isValid = true;
        let reason = '';

        if (selectedEntity === 'departments') {
          const code = getVal('code');
          const name = getVal('name');
          if (!code || !name) {
            isValid = false;
            reason = 'Code and name are required';
          }
        } 
        else if (selectedEntity === 'terms') {
          const name = getVal('name');
          const year = getVal('academic_year');
          const semNum = getVal('semester_number');
          const start = getVal('start_date');
          const end = getVal('end_date');
          
          if (!name || !year || !semNum || !start || !end) {
            isValid = false;
            reason = 'Missing required term parameters';
          } else if (isNaN(parseInt(semNum))) {
            isValid = false;
            reason = 'semester_number must be an integer';
          }
        } 
        else if (selectedEntity === 'batches') {
          const dCode = getVal('department_code');
          const year = getVal('admission_year');
          const sem = getVal('current_semester');
          
          if (!dCode || !year || !sem) {
            isValid = false;
            reason = 'Missing department_code, admission_year, or current_semester';
          } else if (!deptMap.has(dCode.toLowerCase())) {
            isValid = false;
            reason = `Department code '${dCode}' not found`;
          } else if (isNaN(parseInt(year)) || isNaN(parseInt(sem))) {
            isValid = false;
            reason = 'Year and semester must be integers';
          }
        } 
        else if (selectedEntity === 'sections') {
          const dCode = getVal('department_code');
          const year = getVal('admission_year');
          const name = getVal('section_name');

          if (!dCode || !year || !name) {
            isValid = false;
            reason = 'Missing department_code, admission_year, or section_name';
          } else {
            const deptId = deptMap.get(dCode.toLowerCase());
            if (!deptId) {
              isValid = false;
              reason = `Department '${dCode}' not found`;
            } else {
              const batchId = batchMap.get(`${deptId}_${year}`);
              if (!batchId) {
                isValid = false;
                reason = `Batch for department '${dCode}' and admission year '${year}' not found`;
              }
            }
          }
        } 
        else if (selectedEntity === 'faculty') {
          const code = getVal('employee_code');
          const name = getVal('name');
          const dCode = getVal('department_code');

          if (!code || !name || !dCode) {
            isValid = false;
            reason = 'Missing employee_code, name, or department_code';
          } else if (!deptMap.has(dCode.toLowerCase())) {
            isValid = false;
            reason = `Department code '${dCode}' not found`;
          }
        } 
        else if (selectedEntity === 'students') {
          const roll = getVal('roll_no');
          const admission = getVal('admission_no');
          const name = getVal('name');
          const sec = getVal('section_name');
          const officialMail = getVal('official_email');

          if (!roll || !admission || !name || !sec || !officialMail) {
            isValid = false;
            reason = 'Missing roll_no, admission_no, name, section_name, or official_email';
          } else if (!secMap.has(sec.toLowerCase())) {
            isValid = false;
            reason = `Section '${sec}' not found`;
          }
        } 
        else if (selectedEntity === 'courses') {
          const code = getVal('code');
          const name = getVal('name');
          const cred = getVal('credits');
          const type = getVal('course_type');
          const sem = getVal('semester_number');
          const dCode = getVal('department_code');

          if (!code || !name || !cred || !type || !sem || !dCode) {
            isValid = false;
            reason = 'Missing required course fields';
          } else if (!deptMap.has(dCode.toLowerCase())) {
            isValid = false;
            reason = `Department code '${dCode}' not found`;
          } else if (type.toLowerCase() !== 'theory' && type.toLowerCase() !== 'lab') {
            isValid = false;
            reason = `course_type must be 'theory' or 'lab'`;
          } else if (isNaN(parseInt(cred)) || isNaN(parseInt(sem))) {
            isValid = false;
            reason = 'Credits and semester must be integers';
          }
        } 
        else if (selectedEntity === 'course_offerings') {
          const cCode = getVal('course_code');
          const sec = getVal('section_name');
          const fCode = getVal('faculty_code');
          const tName = getVal('term_name');

          if (!cCode || !sec || !fCode || !tName) {
            isValid = false;
            reason = 'Missing course_code, section_name, faculty_code, or term_name';
          } else if (!courseMap.has(cCode.toLowerCase())) {
            isValid = false;
            reason = `Course '${cCode}' not found`;
          } else if (!secMap.has(sec.toLowerCase())) {
            isValid = false;
            reason = `Section '${sec}' not found`;
          } else if (!facMap.has(fCode.toLowerCase())) {
            isValid = false;
            reason = `Faculty code '${fCode}' not found`;
          } else if (!termMap.has(tName.toLowerCase())) {
            isValid = false;
            reason = `Term '${tName}' not found`;
          }
        } 
        else if (selectedEntity === 'enrollments') {
          const roll = getVal('student roll number');
          const cCode = getVal('course code');
          const sec = getVal('section name');
          const tName = getVal('term name');

          if (!roll || !cCode || !sec || !tName) {
            isValid = false;
            reason = 'Missing student roll number, course code, section name, or term name';
          } else {
            const studId = studMap.get(roll.toLowerCase());
            const courseId = courseMap.get(cCode.toLowerCase());
            const secId = secMap.get(sec.toLowerCase());
            const termId = termMap.get(tName.toLowerCase());

            if (!studId) {
              isValid = false;
              reason = `Student Roll Number '${roll}' not found`;
            } else if (!courseId) {
              isValid = false;
              reason = `Course Code '${cCode}' not found`;
            } else if (!secId) {
              isValid = false;
              reason = `Section Name '${sec}' not found`;
            } else if (!termId) {
              isValid = false;
              reason = `Term Name '${tName}' not found`;
            } else {
              const hasOffering = offerings?.some(
                o => o.course_id === courseId && o.section_id === secId && o.term_id === termId
              );
              if (!hasOffering) {
                isValid = false;
                reason = `Course offering not found for Course: '${cCode}', Section: '${sec}', Term: '${tName}'`;
              }
            }
          }
        }

        row.status = isValid ? 'valid' : 'invalid';
        if (reason) row.reason = reason;
      }

      setRows(updatedRows);
      setIsValidated(true);
    } catch (err: any) {
      setGlobalError(`Validation error: ${err.message}`);
    }
  };

  // Perform inserts on valid rows
  const commitRows = async () => {
    setIsUploading(true);
    setUploadSummary(null);
    
    let inserted = 0;
    let duplicate = 0;
    let failed = 0;

    // Cache maps again for mapping codes to foreign keys during insert
    const { data: depts } = await supabase.from('departments').select('id, code');
    const { data: terms } = await supabase.from('terms').select('id, name');
    const { data: batches } = await supabase.from('batches').select('id, department_id, admission_year');
    const { data: sections } = await supabase.from('sections').select('id, name, batch_id');
    const { data: faculty } = await supabase.from('faculty').select('id, employee_code');
    const { data: students } = await supabase.from('students').select('id, roll_no');
    const { data: offerings } = await supabase.from('course_offerings').select('id, course_id, section_id, term_id');
    const { data: courses } = await supabase.from('courses').select('id, code');

    const deptMap = new Map(depts?.map(d => [d.code.toLowerCase(), d.id]));
    const termMap = new Map(terms?.map(t => [t.name.toLowerCase(), t.id]));
    const facMap = new Map(faculty?.map(f => [f.employee_code.toLowerCase(), f.id]));
    const studMap = new Map(students?.map(s => [s.roll_no.toLowerCase(), s.id]));
    const courseMap = new Map(courses?.map(c => [c.code.toLowerCase(), c.id]));
    const secMap = new Map(sections?.map(s => [s.name.toLowerCase(), s.id]));

    const batchMap = new Map<string, string>();
    batches?.forEach(b => {
      batchMap.set(`${b.department_id}_${b.admission_year}`, b.id);
    });

    const offeringMap = new Map<string, string>();
    offerings?.forEach(o => {
      offeringMap.set(`${o.course_id}_${o.section_id}_${o.term_id}`, o.id);
    });

    const fileHeaders = headers.map(h => h.toLowerCase());
    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.status !== 'valid') continue;

      const line = row.data;
      const getVal = (headerName: string) => {
        const idx = fileHeaders.indexOf(headerName);
        return idx !== -1 ? line[idx]?.trim() : '';
      };

      try {
        let payload: any = {};
        let dbError: any = null;

        if (selectedEntity === 'departments') {
          payload = { code: getVal('code'), name: getVal('name') };
          const { error } = await supabase.from('departments').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'terms') {
          payload = {
            name: getVal('name'),
            academic_year: getVal('academic_year'),
            semester_number: parseInt(getVal('semester_number')),
            start_date: getVal('start_date'),
            end_date: getVal('end_date'),
            is_active: getVal('is_active')?.toLowerCase() === 'true' || getVal('is_active') === '1'
          };
          const { error } = await supabase.from('terms').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'batches') {
          const deptId = deptMap.get(getVal('department_code').toLowerCase());
          payload = {
            department_id: deptId,
            admission_year: parseInt(getVal('admission_year')),
            current_semester: parseInt(getVal('current_semester'))
          };
          const { error } = await supabase.from('batches').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'sections') {
          const deptId = deptMap.get(getVal('department_code').toLowerCase());
          const batchId = batchMap.get(`${deptId}_${getVal('admission_year')}`);
          payload = {
            batch_id: batchId,
            name: getVal('section_name')
          };
          const { error } = await supabase.from('sections').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'faculty') {
          const deptId = deptMap.get(getVal('department_code').toLowerCase());
          payload = {
            employee_code: getVal('employee_code'),
            name: getVal('name'),
            department_id: deptId
          };
          const { error } = await supabase.from('faculty').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'students') {
          const secId = secMap.get(getVal('section_name').toLowerCase());
          payload = {
            roll_no: getVal('roll_no'),
            admission_no: getVal('admission_no'),
            name: getVal('name'),
            section_id: secId,
            dob: getVal('dob') || null,
            gender: getVal('gender') || null,
            personal_email: getVal('personal_email') || null,
            official_email: getVal('official_email') || null,
            phone: getVal('phone') || null
          };
          const { error } = await supabase.from('students').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'courses') {
          const deptId = deptMap.get(getVal('department_code').toLowerCase());
          payload = {
            code: getVal('code'),
            name: getVal('name'),
            credits: parseInt(getVal('credits')),
            course_type: getVal('course_type').toLowerCase(),
            semester_number: parseInt(getVal('semester_number')),
            department_id: deptId
          };
          const { error } = await supabase.from('courses').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'course_offerings') {
          const courseId = courseMap.get(getVal('course_code').toLowerCase());
          const secId = secMap.get(getVal('section_name').toLowerCase());
          const facId = facMap.get(getVal('faculty_code').toLowerCase());
          const termId = termMap.get(getVal('term_name').toLowerCase());

          payload = {
            course_id: courseId,
            section_id: secId,
            faculty_id: facId,
            term_id: termId
          };
          const { error } = await supabase.from('course_offerings').insert(payload);
          dbError = error;
        } 
        else if (selectedEntity === 'enrollments') {
          const studId = studMap.get(getVal('student roll number').toLowerCase());
          const courseId = courseMap.get(getVal('course code').toLowerCase());
          const secId = secMap.get(getVal('section name').toLowerCase());
          const termId = termMap.get(getVal('term name').toLowerCase());
          const offeringId = offeringMap.get(`${courseId}_${secId}_${termId}`);

          payload = {
            student_id: studId,
            course_offering_id: offeringId
          };
          const { error } = await supabase.from('enrollments').insert(payload);
          dbError = error;
        }

        if (dbError) {
          // Check for unique index violation (code 23505)
          if (dbError.code === '23505') {
            row.status = 'duplicate';
            row.reason = 'Duplicate entry (already exists in database)';
            duplicate++;
          } else {
            row.status = 'error';
            row.reason = dbError.message || 'Database error occurred';
            failed++;
          }
        } else {
          row.status = 'success';
          inserted++;
        }
      } catch (err: any) {
        row.status = 'error';
        row.reason = err.message || 'Insert crash';
        failed++;
      }
    }

    setRows(updatedRows);
    setUploadSummary({
      inserted,
      duplicate,
      failed,
      total: updatedRows.filter(r => r.status !== 'invalid').length
    });
    setIsUploading(false);
  };

  // Submit manual structural form
  const handleManualSubmit = async (e: React.FormEvent, entity: EntityType) => {
    e.preventDefault();
    setFormFeedback(null);

    try {
      let payload: any = {};
      let error: any = null;

      if (entity === 'departments') {
        payload = manualDept;
        const res = await supabase.from('departments').insert(payload);
        error = res.error;
        if (!error) setManualDept({ code: '', name: '' });
      } 
      else if (entity === 'terms') {
        payload = manualTerm;
        const res = await supabase.from('terms').insert(payload);
        error = res.error;
        if (!error) setManualTerm({
          name: '',
          academic_year: '',
          semester_number: 1,
          start_date: '',
          end_date: '',
          is_active: false,
        });
      } 
      else if (entity === 'batches') {
        const { data: depts } = await supabase.from('departments').select('id').eq('code', manualBatch.department_code).maybeSingle();
        if (!depts) {
          setFormFeedback({ type: 'error', msg: `Department code '${manualBatch.department_code}' does not exist.` });
          return;
        }
        payload = {
          department_id: depts.id,
          admission_year: manualBatch.admission_year,
          current_semester: manualBatch.current_semester
        };
        const res = await supabase.from('batches').insert(payload);
        error = res.error;
        if (!error) setManualBatch({ department_code: '', admission_year: new Date().getFullYear(), current_semester: 1 });
      } 
      else if (entity === 'sections') {
        const { data: depts } = await supabase.from('departments').select('id').eq('code', manualSection.department_code).maybeSingle();
        if (!depts) {
          setFormFeedback({ type: 'error', msg: `Department code '${manualSection.department_code}' does not exist.` });
          return;
        }
        const { data: batch } = await supabase.from('batches').select('id').eq('department_id', depts.id).eq('admission_year', manualSection.admission_year).maybeSingle();
        if (!batch) {
          setFormFeedback({ type: 'error', msg: `Batch not found for department '${manualSection.department_code}' and year '${manualSection.admission_year}'.` });
          return;
        }
        payload = {
          batch_id: batch.id,
          name: manualSection.section_name
        };
        const res = await supabase.from('sections').insert(payload);
        error = res.error;
        if (!error) setManualSection({ department_code: '', admission_year: new Date().getFullYear(), section_name: '' });
      }

      if (error) {
        if (error.code === '23505') {
          setFormFeedback({ type: 'error', msg: 'This record already exists in the database (unique conflict).' });
        } else {
          setFormFeedback({ type: 'error', msg: error.message });
        }
      } else {
        setFormFeedback({ type: 'success', msg: 'Record inserted successfully.' });
      }
    } catch (err: any) {
      setFormFeedback({ type: 'error', msg: err.message || 'Error occurred.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Academic Data Import</h2>
        <p className="text-slate-300 text-sm max-w-2xl">
          Establish structural units manually or bulk-populate rosters, courses, section offerings, and enrollments using standard CSV documents.
        </p>
      </div>

      {/* Tabs Toggles */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('structural');
            setCsvFile(null);
            setHeaders([]);
            setRows([]);
            setUploadSummary(null);
            setGlobalError(null);
            setFormFeedback(null);
          }}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'structural'
              ? 'border-accent-600 text-accent-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Structural Config (Add Form & CSV)
        </button>
        <button
          onClick={() => {
            setActiveTab('academic');
            setCsvFile(null);
            setHeaders([]);
            setRows([]);
            setUploadSummary(null);
            setGlobalError(null);
            setFormFeedback(null);
          }}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'academic'
              ? 'border-accent-600 text-accent-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Large Rosters & Course Data (CSV Only)
        </button>
      </div>

      {/* Manual & CSV Upload Panel */}
      {activeTab === 'structural' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Selection card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm mb-4">1. Choose Structural Entity</h3>
            <div className="space-y-2">
              {[
                { type: 'departments', name: 'Departments', icon: Building2 },
                { type: 'terms', name: 'Academic Terms', icon: Calendar },
                { type: 'batches', name: 'Student Batches', icon: Layers },
                { type: 'sections', name: 'Class Sections', icon: Layers },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    setSelectedEntity(item.type as EntityType);
                    setFormFeedback(null);
                    setCsvFile(null);
                    setHeaders([]);
                    setRows([]);
                    setUploadSummary(null);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${
                    selectedEntity === item.type
                      ? 'border-accent-500 bg-accent-50/50 text-accent-600'
                      : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({expectedHeaders[item.type as EntityType].join(', ')})
                  </span>
                </button>
              ))}
            </div>

            {/* CSV Quick Import Trigger */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Or Upload CSV</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Click to select CSV file</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, selectedEntity)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Form / Manual Entry Container */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-4">
                Manual Entry: {selectedEntity.toUpperCase()}
              </h3>

              {formFeedback && (
                <div className={`mb-6 p-4 rounded-xl flex gap-3 text-xs border ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <p>{formFeedback.msg}</p>
                </div>
              )}

              <form onSubmit={(e) => handleManualSubmit(e, selectedEntity)} className="space-y-4">
                {selectedEntity === 'departments' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Department Code</label>
                      <input
                        type="text"
                        required
                        value={manualDept.code}
                        onChange={(e) => setManualDept({ ...manualDept, code: e.target.value })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        placeholder="e.g. CSE"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Department Name</label>
                      <input
                        type="text"
                        required
                        value={manualDept.name}
                        onChange={(e) => setManualDept({ ...manualDept, name: e.target.value })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        placeholder="Computer Science Engineering"
                      />
                    </div>
                  </div>
                )}

                {selectedEntity === 'terms' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Term Name</label>
                        <input
                          type="text"
                          required
                          value={manualTerm.name}
                          onChange={(e) => setManualTerm({ ...manualTerm, name: e.target.value })}
                          className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                          placeholder="e.g. Autumn Semester 2026"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Academic Year</label>
                        <input
                          type="text"
                          required
                          value={manualTerm.academic_year}
                          onChange={(e) => setManualTerm({ ...manualTerm, academic_year: e.target.value })}
                          className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                          placeholder="2026-2027"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Semester Number</label>
                        <input
                          type="number"
                          required
                          value={manualTerm.semester_number}
                          onChange={(e) => setManualTerm({ ...manualTerm, semester_number: parseInt(e.target.value) || 1 })}
                          className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
                        <input
                          type="date"
                          required
                          value={manualTerm.start_date}
                          onChange={(e) => setManualTerm({ ...manualTerm, start_date: e.target.value })}
                          className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
                        <input
                          type="date"
                          required
                          value={manualTerm.end_date}
                          onChange={(e) => setManualTerm({ ...manualTerm, end_date: e.target.value })}
                          className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        />
                      </div>
                      <div className="flex items-center h-full pt-6">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={manualTerm.is_active}
                            onChange={(e) => setManualTerm({ ...manualTerm, is_active: e.target.checked })}
                            className="rounded text-accent-600 focus:ring-accent-500 w-4 h-4"
                          />
                          Mark as Active Term
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEntity === 'batches' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Department Code</label>
                      <input
                        type="text"
                        required
                        value={manualBatch.department_code}
                        onChange={(e) => setManualBatch({ ...manualBatch, department_code: e.target.value })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        placeholder="e.g. CSE"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Admission Year</label>
                      <input
                        type="number"
                        required
                        value={manualBatch.admission_year}
                        onChange={(e) => setManualBatch({ ...manualBatch, admission_year: parseInt(e.target.value) || new Date().getFullYear() })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Current Semester</label>
                      <input
                        type="number"
                        required
                        value={manualBatch.current_semester}
                        onChange={(e) => setManualBatch({ ...manualBatch, current_semester: parseInt(e.target.value) || 1 })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                      />
                    </div>
                  </div>
                )}

                {selectedEntity === 'sections' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Department Code</label>
                      <input
                        type="text"
                        required
                        value={manualSection.department_code}
                        onChange={(e) => setManualSection({ ...manualSection, department_code: e.target.value })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        placeholder="e.g. CSE"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Admission Year</label>
                      <input
                        type="number"
                        required
                        value={manualSection.admission_year}
                        onChange={(e) => setManualSection({ ...manualSection, admission_year: parseInt(e.target.value) || new Date().getFullYear() })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Section Name</label>
                      <input
                        type="text"
                        required
                        value={manualSection.section_name}
                        onChange={(e) => setManualSection({ ...manualSection, section_name: e.target.value })}
                        className="block w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                        placeholder="e.g. CSE-A"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold text-xs tracking-wide shadow flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Save Record
                </button>
              </form>
            </div>
            
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <Info className="w-4 h-4" />
              <span>Ensure parent entities exist in the database before submitting manual values.</span>
            </div>
          </div>
        </div>
      ) : (
        /* CSV-Only large rosters section */
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Select Roster or Curricular Entity to Upload</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { type: 'faculty', name: 'Faculty Staff', icon: Users },
              { type: 'students', name: 'Students list', icon: GraduationCap },
              { type: 'courses', name: 'Courses list', icon: BookOpen },
              { type: 'course_offerings', name: 'Section Offerings', icon: Layers },
              { type: 'enrollments', name: 'Student Enrollments', icon: RefreshCw },
            ].map((item) => (
              <label
                key={item.type}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-all text-center group ${
                  selectedEntity === item.type
                    ? 'border-accent-500 bg-accent-50/20 text-accent-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <item.icon className="w-8 h-8 text-slate-400 group-hover:text-accent-500 mb-2 transition-colors" />
                <span className="text-xs font-bold">{item.name}</span>
                <span className="text-[10px] text-slate-400 font-mono mt-1 select-none">
                  ({expectedHeaders[item.type as EntityType][0]}, ...)
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, item.type as EntityType)}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* CSV Parser Preview and Action Console */}
      {csvFile && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Selected CSV: <span className="text-accent-600 font-mono">{csvFile.name}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Target Entity: <strong className="uppercase font-semibold">{selectedEntity}</strong> | Total rows parsed: <strong className="text-slate-600 font-semibold">{rows.length}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={validateRows}
                disabled={isUploading}
                className="px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Database className="w-4 h-4 text-slate-500" />
                Validate CSV Rows
              </button>

              <button
                onClick={commitRows}
                disabled={!isValidated || isUploading || rows.filter(r => r.status === 'valid').length === 0}
                className="px-5 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow shadow-accent-600/10 animate-fade-in"
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Import {rows.filter(r => r.status === 'valid').length} Valid Rows
              </button>
            </div>
          </div>

          {/* Validation Global Error */}
          {globalError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-800 text-xs animate-shake">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <div>
                <strong className="font-semibold text-rose-700">CSV Error:</strong>
                <p className="mt-1 leading-normal">{globalError}</p>
              </div>
            </div>
          )}

          {/* Upload Summary Feedback */}
          {uploadSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-900 text-xs animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                CSV Import Completed
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-emerald-200/50">
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold">Total Valid Evaluated</span>
                  <p className="text-lg font-extrabold text-emerald-800">{uploadSummary.total}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold text-emerald-700">Successfully Inserted</span>
                  <p className="text-lg font-extrabold text-emerald-800">{uploadSummary.inserted}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold text-amber-600">Skipped (Duplicate)</span>
                  <p className="text-lg font-extrabold text-amber-700">{uploadSummary.duplicate}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold text-rose-500">Failed (DB Error)</span>
                  <p className="text-lg font-extrabold text-rose-600">{uploadSummary.failed}</p>
                </div>
              </div>
            </div>
          )}

          {/* Preview Roster / Columns */}
          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <div className="max-h-[350px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-600">
                <thead className="bg-slate-50 sticky top-0 text-slate-400 font-bold uppercase tracking-wider text-[10px] z-10 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-center">Row</th>
                    <th className="px-4 py-3">Validation Status</th>
                    {headers.map((head, idx) => (
                      <th key={idx} className="px-4 py-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => (
                    <tr
                      key={row.rowNum}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        row.status === 'invalid'
                          ? 'bg-rose-50/20'
                          : row.status === 'success'
                          ? 'bg-emerald-50/10'
                          : row.status === 'duplicate'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-center text-slate-400 font-medium">{row.rowNum}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          row.status === 'pending'
                            ? 'bg-slate-50 border-slate-200 text-slate-500'
                            : row.status === 'valid'
                            ? 'bg-blue-50 border-blue-200 text-blue-600'
                            : row.status === 'invalid'
                            ? 'bg-rose-50 border-rose-200 text-rose-600'
                            : row.status === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                            : row.status === 'duplicate'
                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'bg-rose-100 border-rose-300 text-rose-800'
                        }`}>
                          {row.status.toUpperCase()}
                          {row.reason && (
                            <span className="font-normal block max-w-xs truncate text-[9px] text-slate-500">
                              - {row.reason}
                            </span>
                          )}
                        </span>
                      </td>
                      {row.data.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 truncate max-w-xs">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
