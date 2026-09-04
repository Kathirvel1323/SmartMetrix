import React from 'react';
import { Database } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading SmartMetrix Command Data...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 my-4">
      <div className="relative flex items-center justify-center w-12 h-12 mb-3">
        <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-400 rounded-full animate-spin"></div>
        <Database className="w-5 h-5 text-teal-400 absolute" />
      </div>
      <p className="text-xs font-semibold tracking-wider text-slate-300 uppercase animate-pulse">
        {message}
      </p>
    </div>
  );
};
