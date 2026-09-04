import React from 'react';

export const CardSkeleton: React.FC = () => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 animate-pulse">
    <div className="h-3 bg-slate-700/60 rounded w-1/3 mb-3"></div>
    <div className="h-8 bg-slate-700/80 rounded w-1/2 mb-4"></div>
    <div className="h-3 bg-slate-700/40 rounded w-3/4"></div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden animate-pulse">
    <div className="bg-slate-800/80 h-10 border-b border-slate-700/60"></div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-800/60">
        <div className="h-4 bg-slate-800 rounded w-1/6"></div>
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-4 bg-slate-800 rounded w-1/4"></div>
        <div className="h-4 bg-slate-800 rounded w-1/8"></div>
      </div>
    ))}
  </div>
);

export const DetailSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-6 bg-slate-800 rounded w-1/4"></div>
    <div className="h-32 bg-slate-800/50 border border-slate-800 rounded-xl"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-24 bg-slate-800/50 border border-slate-800 rounded-xl"></div>
      <div className="h-24 bg-slate-800/50 border border-slate-800 rounded-xl"></div>
    </div>
  </div>
);
