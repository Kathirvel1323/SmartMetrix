import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && <span className="absolute left-3 text-slate-400 pointer-events-none">{icon}</span>}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-slate-900/80 border ${
              error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-teal-500 focus:ring-teal-500'
            } text-slate-100 placeholder-slate-500 text-sm rounded-lg px-3 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-opacity-20 disabled:opacity-50 ${
              icon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && <span className="absolute right-3 flex items-center text-slate-400">{rightIcon}</span>}
        </div>
        {error && <span className="text-xs text-red-400 mt-0.5">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-400">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
