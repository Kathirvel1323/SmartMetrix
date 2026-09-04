import React from 'react';
import { Database, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface StateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<StateProps> = ({
  title = 'No Data Found',
  description = 'No records match the requested filter criteria.',
  action,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-700/80 my-4">
      <div className="p-4 bg-slate-800/80 rounded-full border border-slate-700 text-teal-400 mb-3 shadow-inner">
        {icon || <FileSpreadsheet className="w-8 h-8 opacity-80" />}
      </div>
      <h4 className="text-base font-bold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

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

export const ErrorState: React.FC<StateProps & { onRetry?: () => void }> = ({
  title = 'Unable to Load Data',
  description = 'A network or authorization error occurred while requesting data from the server.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl bg-red-950/20 border border-red-900/50 my-4">
      <div className="p-3 bg-red-900/40 rounded-full text-red-400 mb-3 border border-red-800/60">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-bold text-slate-100">{title}</h4>
      <p className="text-xs text-slate-300 max-w-md mt-1 mb-4">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-xs font-medium bg-red-800 hover:bg-red-700 text-white rounded-lg transition-colors border border-red-600/40"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
