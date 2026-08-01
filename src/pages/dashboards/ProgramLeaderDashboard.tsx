import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Calendar, Users, Layers } from 'lucide-react';

export function ProgramLeaderDashboard() {
  const [stats, setStats] = useState({
    batches: 0,
    sections: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPLStats() {
      setLoading(true);
      try {
        const [
          { count: batchCount },
          { count: sectionCount },
          { count: studentCount }
        ] = await Promise.all([
          supabase.from('batches').select('*', { count: 'exact', head: true }),
          supabase.from('sections').select('*', { count: 'exact', head: true }),
          supabase.from('students').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          batches: batchCount ?? 0,
          sections: sectionCount ?? 0,
          students: studentCount ?? 0,
        });
      } catch (err) {
        console.error('Error loading PL dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPLStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Program Leader Overview</h2>
        <p className="text-slate-200 text-sm max-w-2xl">
          Coordinate program batches, track curriculum compliance, review section performance, and audit overall class attendance statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: 'Program Batches', value: loading ? '...' : stats.batches, icon: Calendar, color: 'text-indigo-500 bg-indigo-50 border-indigo-100' },
          { name: 'Sections', value: loading ? '...' : stats.sections, icon: Layers, color: 'text-cyan-500 bg-cyan-50 border-cyan-100' },
          { name: 'Assigned Students', value: loading ? '...' : stats.students, icon: Users, color: 'text-emerald-500 bg-emerald-50 border-emerald-100' },
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

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-2">Departmental Courses</h3>
        <p className="text-xs text-slate-400 mb-6">Course structure and faculty allocation</p>
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-slate-200 text-center">
          <BookOpen className="w-8 h-8 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">No active course models linked yet</p>
          <p className="text-xs text-slate-400 max-w-xs mt-1">Complete structural mappings in the database to display departmental curriculums.</p>
        </div>
      </div>
    </div>
  );
}
