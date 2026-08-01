import { Users } from 'lucide-react';

export function ParentDashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Parent Dashboard</h2>
        <p className="text-slate-200 text-sm max-w-2xl">
          Monitor your ward's attendance details, view semester summaries, and track academic attendance alerts.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-slate-50 border border-slate-150 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">No Linked Students</h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-4">
          There are currently <strong>0</strong> student records linked to your parent account.
        </p>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Please contact the program leader or administration office to register your email and link your parent account to your ward's profile.
        </p>
      </div>
    </div>
  );
}
