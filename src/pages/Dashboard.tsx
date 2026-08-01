import { useAuth } from '../hooks/useAuth';
import {
  Users,
  CheckCircle,
  Calendar,
  Percent,
  TrendingUp,
  Clock
} from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();

  const stats = [
    {
      name: 'Total Students',
      value: '154',
      change: '+2 this week',
      changeType: 'positive',
      icon: Users,
      color: 'text-blue-500 bg-blue-50',
    },
    {
      name: 'Active Classes',
      value: '12',
      change: '4 scheduled today',
      changeType: 'neutral',
      icon: Calendar,
      color: 'text-amber-500 bg-amber-50',
    },
    {
      name: 'Avg. Attendance',
      value: '92.4%',
      change: '+1.5% from last month',
      changeType: 'positive',
      icon: Percent,
      color: 'text-emerald-500 bg-emerald-50',
    },
    {
      name: 'Pending Tasks',
      value: '5',
      change: 'Requires review',
      changeType: 'attention',
      icon: Clock,
      color: 'text-rose-500 bg-rose-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 md:p-8 text-white shadow-xl shadow-navy-950/10">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2 text-white">
            Welcome back, {user?.email?.split('@')[0]}!
          </h2>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Here's what's happening with your classes today. Monitor attendance, manage student rosters, and generate compliance reports seamlessly.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-xl p-6 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-500">{stat.name}</span>
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-800 tracking-tight">{stat.value}</span>
                <span className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                  stat.changeType === 'positive'
                    ? 'text-emerald-600'
                    : stat.changeType === 'attention'
                    ? 'text-rose-500'
                    : 'text-slate-400'
                }`}>
                  {stat.changeType === 'positive' && <TrendingUp className="w-3.5 h-3.5" />}
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity / Overview Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Sessions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Recent Attendance Sessions</h3>
              <p className="text-xs text-slate-400">Recently completed or active class roll calls</p>
            </div>
            <button className="text-xs font-semibold text-accent-600 hover:text-accent-700 px-3 py-1.5 rounded-lg bg-accent-50 hover:bg-accent-100/80 transition-colors">
              View All
            </button>
          </div>

          <div className="space-y-4">
            {[
              { subject: 'Introduction to Computer Science', code: 'CS101', time: 'Today, 9:00 AM', present: '42/45', status: 'Completed' },
              { subject: 'Database Management Systems', code: 'CS302', time: 'Today, 11:30 AM', present: '28/30', status: 'Completed' },
              { subject: 'Software Engineering Workshop', code: 'CS412', time: 'Today, 2:00 PM', present: '14/15', status: 'In Progress' }
            ].map((session, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">{session.subject}</span>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="font-mono bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-500 font-semibold">{session.code}</span>
                    <span>•</span>
                    <span>{session.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{session.present}</p>
                    <p className="text-xs text-slate-400">Present</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    session.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                  }`}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Mini checklist or quick actions */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">Quick Actions</h3>
            <p className="text-xs text-slate-400 mb-6">Commonly used shortcuts and tasks</p>
            
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between group transition-all duration-150">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">Take Attendance</span>
                  <span className="text-xs text-slate-400">Launch manual scanner/roll call</span>
                </div>
                <span className="text-slate-400 group-hover:text-accent-600 transition-colors font-bold text-lg">→</span>
              </button>

              <button className="w-full text-left px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between group transition-all duration-150">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">Add Student</span>
                  <span className="text-xs text-slate-400">Register new profile to catalog</span>
                </div>
                <span className="text-slate-400 group-hover:text-accent-600 transition-colors font-bold text-lg">→</span>
              </button>

              <button className="w-full text-left px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between group transition-all duration-150">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">Generate Report</span>
                  <span className="text-xs text-slate-400">Export CSV or PDF reports</span>
                </div>
                <span className="text-slate-400 group-hover:text-accent-600 transition-colors font-bold text-lg">→</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>System Status: <strong className="text-emerald-500">Online</strong></span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
