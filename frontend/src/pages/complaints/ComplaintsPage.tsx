import React, { useEffect, useState } from 'react';
import { complaintService } from '../../services/complaint.service';
import type { ComplaintItem } from '../../services/complaint.service';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';

export const ComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / status update state
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('UNDER_INVESTIGATION');
  const [remarks, setRemarks] = useState<string>('');
  const [resolutionSummary, setResolutionSummary] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const data = await complaintService.listComplaints();
      setComplaints(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setIsUpdating(true);
    try {
      await complaintService.updateComplaintStatus(selectedComplaint.complaintId, {
        status: updateStatus,
        remarks,
        resolutionSummary
      });
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (err: any) {
      alert(err.message || 'Failed to update complaint status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-500/40">RESOLVED</span>;
      case 'UNDER_INVESTIGATION':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">UNDER INVESTIGATION</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-500/40">REJECTED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">RECEIVED</span>;
    }
  };

  if (isLoading && complaints.length === 0) {
    return <LoadingState message="Loading statutory consumer complaints..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumer Complaints Management"
        subtitle="Publicly filed statutory complaints and enforcement tracking portal."
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300">
          {error}
        </div>
      )}

      {complaints.length === 0 ? (
        <EmptyState
          title="No Consumer Complaints Logged"
          description="There are currently no statutory consumer complaints recorded in the system."
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Complaint ID</th>
                  <th className="p-4">Tracking Token</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {complaints.map((c) => (
                  <tr key={c._id || c.complaintId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-100">{c.complaintId}</td>
                    <td className="p-4 font-mono text-teal-400">{c.trackingToken}</td>
                    <td className="p-4">{c.category}</td>
                    <td className="p-4">{c.city}, {c.state}</td>
                    <td className="p-4">{getStatusBadge(c.status)}</td>
                    <td className="p-4 font-mono text-slate-400">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setUpdateStatus(c.status);
                          setRemarks(c.remarks || '');
                          setResolutionSummary(c.resolutionSummary || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                      >
                        {user?.role === 'ADMIN' ? 'Manage / Review' : 'View Details'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complaint Detail & Status Update Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] text-teal-400 font-mono block">COMPLAINT RECORD</span>
                <h3 className="text-lg font-bold text-slate-100 font-mono">{selectedComplaint.complaintId}</h3>
              </div>
              {getStatusBadge(selectedComplaint.status)}
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">Category</span>
                  <span className="font-semibold text-slate-200">{selectedComplaint.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Business / Device</span>
                  <span className="font-semibold text-slate-200">{selectedComplaint.businessName || selectedComplaint.instrumentId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Location</span>
                  <span className="font-semibold text-slate-200">{selectedComplaint.city}, {selectedComplaint.state}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Tracking Token</span>
                  <span className="font-mono text-teal-400 font-bold">{selectedComplaint.trackingToken}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-semibold mb-1">Consumer Description</span>
                <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 italic">
                  "{selectedComplaint.description}"
                </p>
              </div>

              {user?.role === 'ADMIN' ? (
                <form onSubmit={handleUpdateStatus} className="space-y-3 pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-teal-400 uppercase block">Admin Action & Resolution</span>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Update Status</label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                    >
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="UNDER_INVESTIGATION">UNDER_INVESTIGATION</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Inspector Remarks</label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter investigation notes..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Resolution Summary</label>
                    <textarea
                      rows={2}
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Enter statutory resolution summary for public tracking..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
                    >
                      {isUpdating ? 'Saving...' : 'Save Resolution'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedComplaint(null)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="pt-2">
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
