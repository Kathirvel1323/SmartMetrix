import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { publicService } from '../../services/public.service';
import { Search, ShieldAlert, CheckCircle, Clock, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';

export const TrackComplaintPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState(tokenParam);
  const [complaint, setComplaint] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (token: string) => {
    if (!token.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await publicService.trackComplaint(token.trim());
      setComplaint(data);
    } catch (err: any) {
      setError(err.message || 'Tracking token not found or invalid.');
      setComplaint(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tokenParam) {
      fetchStatus(tokenParam);
    }
  }, [tokenParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(tokenInput);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-950 text-teal-300 border border-teal-500/40 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> RESOLVED</span>;
      case 'UNDER_REVIEW':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-950 text-sky-300 border border-sky-500/40 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> UNDER REVIEW</span>;
      case 'INVESTIGATING':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> INVESTIGATING</span>;
      case 'DISMISSED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-500/40 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> DISMISSED</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> SUBMITTED</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <Logo />
        <Link to="/public/complaints/new" className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to File Complaint
        </Link>
      </header>

      <main className="max-w-2xl mx-auto w-full my-8 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-6 h-6 text-teal-400" /> Track Consumer Complaint Status
            </h1>
            <p className="text-xs text-slate-400">
              Enter your tracking token generated during complaint submission to check live investigation status.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              required
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Enter tracking token (e.g. TRK-ABC123XYZ)"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white transition-colors"
            >
              {isLoading ? 'Searching...' : 'Track'}
            </button>
          </form>

          {error && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 text-center space-y-1">
              <ShieldAlert className="w-8 h-8 text-red-400 mx-auto" />
              <p className="font-bold">Tracking Record Not Found</p>
              <p className="text-slate-400">{error}</p>
            </div>
          )}

          {complaint && (
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Complaint Reference</span>
                  <span className="text-sm font-bold text-slate-100 font-mono">{complaint.complaintId || complaint.trackingToken}</span>
                </div>
                {getStatusBadge(complaint.status)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Category</span>
                  <span className="font-semibold text-slate-200">{complaint.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Location</span>
                  <span className="font-semibold text-slate-200">{complaint.city}, {complaint.state}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Date Submitted</span>
                  <span className="font-mono text-slate-300">
                    {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Business</span>
                  <span className="font-semibold text-slate-200">{complaint.businessName || 'Not specified'}</span>
                </div>
              </div>

              {complaint.remarks && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="text-[10px] font-bold text-teal-400 uppercase block">Inspector Remarks</span>
                  <p>{complaint.remarks}</p>
                </div>
              )}

              {complaint.resolutionSummary && (
                <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-800/40 text-xs text-teal-200 space-y-1">
                  <span className="text-[10px] font-bold text-teal-400 uppercase block">Statutory Resolution</span>
                  <p>{complaint.resolutionSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-800 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} SmartMetrix Consumer Protection Portal.
      </footer>
    </div>
  );
};
