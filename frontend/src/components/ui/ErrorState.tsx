import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface StateProps {
  title?: string;
  description?: string;
}

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
