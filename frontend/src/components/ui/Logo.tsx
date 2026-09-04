import React from 'react';

interface LogoProps {
  className?: string;
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-9', collapsed = false }) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-slate-900 shadow-md shadow-teal-500/20 border border-teal-400/30">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          <path d="M12 2v20M2 12h20" className="opacity-40" />
          <path d="M5 9l7-7 7 7" />
          <circle cx="12" cy="12" r="3" className="fill-teal-300 stroke-teal-200" />
          <path d="M9 19h6" />
        </svg>
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-400"></span>
        </span>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            SmartMetrix
          </span>
          <span className="text-[10px] font-semibold tracking-widest text-teal-400 uppercase -mt-1">
            Command Center
          </span>
        </div>
      )}
    </div>
  );
};
