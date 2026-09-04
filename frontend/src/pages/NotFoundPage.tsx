import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial from-teal-500/5 via-transparent to-transparent pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10">
        <div className="w-16 h-16 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-center text-teal-400 mx-auto mb-5 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
          ERROR 404
        </span>

        <h1 className="text-2xl font-black text-white mt-4 tracking-tight">
          Command Endpoint Not Found
        </h1>
        <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
          The requested system pathway or legal metrology asset does not exist or has been moved within the registry.
        </p>

        <Link to="/dashboard" className="block">
          <Button variant="primary" className="w-full flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Return to Command Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
