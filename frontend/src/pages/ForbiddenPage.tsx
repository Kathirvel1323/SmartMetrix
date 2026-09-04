import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ForbiddenPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-radial from-red-500/5 via-transparent to-transparent pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10">
        <div className="w-16 h-16 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-center justify-center text-red-400 mx-auto mb-5 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <span className="text-xs font-mono font-bold tracking-widest text-red-400 uppercase bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
          ERROR 403
        </span>

        <h1 className="text-2xl font-black text-white mt-4 tracking-tight">
          Restricted Security Access
        </h1>
        <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
          Your credentials do not possess the required RBAC authorization clearance to access this Legal Metrology resource.
        </p>

        <Link to="/dashboard" className="block">
          <Button variant="primary" className="w-full flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default ForbiddenPage;
