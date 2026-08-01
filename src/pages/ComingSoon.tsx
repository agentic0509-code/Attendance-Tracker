import { AlertCircle } from 'lucide-react';

interface ComingSoonProps {
  title: string;
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-16 h-16 bg-accent-50 rounded-2xl flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8 text-accent-600 animate-bounce" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">{title} Module</h2>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
        We are building the {title.toLowerCase()} capabilities. In the next steps, we will connect the database tables, create schemas, and implement full features for this section.
      </p>
      <div className="px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Setup Complete
      </div>
    </div>
  );
}
