import React, { useState, useEffect } from 'react';
import { noticeService } from '../../services/notice.service';
import type { ImprovementNotice, NoticeStatus } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Select } from '../../components/ui/Select';
import { AlertOctagon, Calendar, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type BadgeVariant = 'pass' | 'fail' | 'pending' | 'info';

const statusVariant = (status: NoticeStatus): BadgeVariant => {
  if (status === 'CLOSED') return 'pass';
  if (status === 'ESCALATED') return 'fail';
  if (status === 'OPEN') return 'fail';
  return 'pending';
};

const formatDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '–';

const isOverdue = (deadline: string) => new Date(deadline) < new Date();

export const NoticesPage: React.FC = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<ImprovementNotice[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [closingNotice, setClosingNotice] = useState<ImprovementNotice | null>(null);
  const [closureRemarks, setClosureRemarks] = useState('');

  const loadNotices = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await noticeService.listNotices();
      setNotices(data);
    } catch {
      setError('Failed to load improvement notices from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const handleStatusUpdate = async (
    noticeId: string,
    newStatus: NoticeStatus,
    closeRemarks?: string
  ) => {
    setUpdatingId(noticeId);
    setActionError('');
    try {
      await noticeService.updateNoticeStatus(noticeId, newStatus, undefined, closeRemarks);
      setNotices((prev) =>
        prev.map((n) =>
          n.noticeId === noticeId
            ? { ...n, status: newStatus, closureRemarks: closeRemarks || n.closureRemarks }
            : n
        )
      );
      if (newStatus === 'CLOSED') {
        setClosingNotice(null);
        setClosureRemarks('');
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to update notice status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) return <LoadingState message="Loading Improvement Notices..." />;
  if (error) return <ErrorState title="Notices Unavailable" description={error} onRetry={loadNotices} />;

  const filteredNotices = statusFilter
    ? notices.filter((n) => n.status === statusFilter)
    : notices;

  const openCount = notices.filter((n) => n.status === 'OPEN').length;
  const escalatedCount = notices.filter((n) => n.status === 'ESCALATED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Improvement Notices"
        subtitle="Enforcement orders issued for non-compliant instruments. OWNER must comply by the statutory deadline."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Improvement Notices' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadNotices}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        }
      />

      {actionError && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-950/50 text-xs font-medium text-red-300">
          {actionError}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Notices', value: notices.length, color: 'text-slate-200' },
          { label: 'Open', value: openCount, color: 'text-red-400' },
          { label: 'Escalated', value: escalatedCount, color: 'text-purple-400' },
          { label: 'Closed', value: notices.filter((n) => n.status === 'CLOSED').length, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center"
          >
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: 'All Statuses', value: '' },
              { label: 'Open', value: 'OPEN' },
              { label: 'Correction In Progress', value: 'CORRECTION_IN_PROGRESS' },
              { label: 'Reinspection Pending', value: 'REINSPECTION_PENDING' },
              { label: 'Escalated', value: 'ESCALATED' },
              { label: 'Closed', value: 'CLOSED' },
            ]}
            className="w-full sm:w-72"
          />
        </div>
      </Card>

      {/* Notice list */}
      {filteredNotices.length === 0 ? (
        <Card>
          <div className="py-14 text-center text-slate-400 space-y-2">
            <AlertOctagon className="w-10 h-10 mx-auto text-teal-600 opacity-40" />
            <p className="text-sm font-medium">No improvement notices found.</p>
            <p className="text-xs text-slate-500">
              Notices are issued by Inspectors following failed inspection results.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => {
            const overdue = isOverdue(notice.deadline) && notice.status !== 'CLOSED';
            return (
              <Card
                key={notice._id}
                className={overdue ? 'border-red-500/30' : undefined}
              >
                {overdue && (
                  <div className="mb-3 flex items-center gap-2 p-2 bg-red-950/40 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs font-bold text-red-400">
                      OVERDUE — Statutory deadline has passed
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {notice.noticeId}
                      </span>
                      <Badge variant={statusVariant(notice.status)}>{notice.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100">
                      {typeof notice.instrument === 'object' && notice.instrument !== null
                        ? `${(notice.instrument as any).manufacturer || ''} ${(notice.instrument as any).model || ''}`.trim() ||
                          (notice.instrument as any).instrumentId || 'Unknown Instrument'
                        : String(notice.instrument)}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">{notice.reason}</p>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Required Correction</span>
                    <span className="text-slate-200 font-medium text-right max-w-[60%]">
                      {notice.requiredCorrection}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Issue Date</span>
                    <span className="font-mono text-slate-300">
                      {formatDate(notice.issueDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statutory Deadline</span>
                    <span
                      className={`font-mono font-bold ${
                        overdue ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {formatDate(notice.deadline)}
                    </span>
                  </div>
                  {notice.closureRemarks && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Closure Remarks</span>
                      <span className="text-emerald-400 font-medium">
                        {notice.closureRemarks}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status actions (ADMIN/INSPECTOR only) */}
                {(user?.role === 'ADMIN' || user?.role === 'INSPECTOR') &&
                  notice.status !== 'CLOSED' && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {notice.status === 'OPEN' && (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={updatingId === notice.noticeId}
                          onClick={() =>
                            handleStatusUpdate(
                              notice.noticeId,
                              'CORRECTION_IN_PROGRESS'
                            )
                          }
                        >
                          Mark In Progress
                        </Button>
                      )}
                      {notice.status === 'CORRECTION_IN_PROGRESS' && (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={updatingId === notice.noticeId}
                          onClick={() => handleStatusUpdate(notice.noticeId, 'REINSPECTION_PENDING')}
                        >
                          Mark Reinspection Pending
                        </Button>
                      )}
                      {notice.status === 'REINSPECTION_PENDING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          isLoading={updatingId === notice.noticeId}
                          onClick={() => {
                            setClosingNotice(notice);
                            setClosureRemarks('');
                          }}
                        >
                          Close Notice
                        </Button>
                      )}
                      {notice.status !== 'ESCALATED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={updatingId === notice.noticeId}
                          onClick={() =>
                            handleStatusUpdate(notice.noticeId, 'ESCALATED')
                          }
                        >
                          Escalate
                        </Button>
                      )}
                    </div>
                  )}
              </Card>
            );
          })}
        </div>
      )}

      {closingNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleStatusUpdate(closingNotice.noticeId, 'CLOSED', closureRemarks.trim());
            }}
            className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-slate-100">Close {closingNotice.noticeId}</h3>
              <p className="text-xs text-slate-400 mt-1">Record the reinspection or compliance evidence used to close this notice.</p>
            </div>
            <textarea
              required
              minLength={5}
              rows={4}
              value={closureRemarks}
              onChange={(event) => setClosureRemarks(event.target.value)}
              placeholder="e.g. Reinspection completed; instrument recalibrated and verified compliant."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 outline-none focus:border-teal-500"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setClosingNotice(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={updatingId === closingNotice.noticeId}>
                Confirm Closure
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
