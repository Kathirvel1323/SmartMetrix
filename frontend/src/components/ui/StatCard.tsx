import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: 'teal' | 'amber' | 'emerald' | 'sky' | 'purple' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'teal',
}) => {
  const colorMap = {
    teal: 'from-teal-500/10 to-slate-800 border-teal-500/30 text-teal-400',
    amber: 'from-amber-500/10 to-slate-800 border-amber-500/30 text-amber-400',
    emerald: 'from-emerald-500/10 to-slate-800 border-emerald-500/30 text-emerald-400',
    sky: 'from-sky-500/10 to-slate-800 border-sky-500/30 text-sky-400',
    purple: 'from-purple-500/10 to-slate-800 border-purple-500/30 text-purple-400',
    red: 'from-red-500/10 to-slate-800 border-red-500/30 text-red-400',
  };

  const iconTextColorMap = {
    teal: 'text-teal-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    sky: 'text-sky-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
  };

  return (
    <div className={`relative bg-gradient-to-br ${colorMap[color]} border rounded-xl p-5 shadow-lg flex flex-col justify-between overflow-hidden group hover:border-teal-500/50 transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
          <div className="text-3xl font-extrabold tracking-tight text-white mt-2 font-mono">
            {value}
          </div>
        </div>
        <div className={`p-3 bg-slate-900/60 border border-slate-700/60 rounded-xl ${iconTextColorMap[color]} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/40 text-xs">
          {trend && (
            <span className={`font-semibold ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
