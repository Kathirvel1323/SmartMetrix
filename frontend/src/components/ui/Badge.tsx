import React from 'react';

export type BadgeVariant =
  | 'pass'
  | 'fail'
  | 'pending'
  | 'scheduled'
  | 'review'
  | 'active'
  | 'expired'
  | 'info'
  | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const styles: Record<BadgeVariant, string> = {
    pass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    active: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    fail: 'bg-red-950/80 text-red-300 border-red-500/40',
    expired: 'bg-red-950/80 text-red-300 border-red-500/40',
    pending: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    review: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    scheduled: 'bg-teal-950/80 text-teal-300 border-teal-500/40',
    info: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
