import React, { useState, useEffect, useCallback } from 'react';
import { auditService } from '../../services/audit.service';
import type { AuditLogItem } from '../../services/audit.service';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Filter } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await auditService.getAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        resultStatus: resultStatus || undefined,
        page,
        limit: 20
      });
      setLogs(res.logs);
      setPagination(res.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [action, entityType, resultStatus]);

  useEffect(() => {
    void fetchLogs(1);
  }, [fetchLogs]);

  if (isLoading && logs.length === 0) {
    return <LoadingState message="Loading immutable statutory audit trail logs..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Audit Trail"
        subtitle="Immutable administrative and operational audit log ledger for compliance tracking."
      />

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-bold text-slate-300">Filters:</span>
        </div>

        <div className="flex flex-wrap gap-3 flex-1">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Entity Types</option>
            <option value="INSTRUMENT">Instrument</option>
            <option value="INSPECTION">Inspection</option>
            <option value="VERIFICATION">Verification</option>
            <option value="CERTIFICATE">Certificate</option>
            <option value="NOTICE">Notice</option>
            <option value="USER">User</option>
            <option value="DEMO_DATA">Demo Data</option>
          </select>

          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter action (e.g. CREATE)"
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 w-48"
          />

          <select
            value={resultStatus}
            onChange={(e) => setResultStatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300">
          {error}
        </div>
      )}

      {logs.length === 0 ? (
        <EmptyState
          title="No Audit Logs Found"
          description="No system operations matching the selected filter criteria have been recorded."
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor / Role</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target Entity</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {logs.map((log) => (
                  <tr key={log._id || log.auditId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-200 block">{log.actorRole}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{log.actorUserId || 'System'}</span>
                    </td>
                    <td className="p-4 font-mono font-bold text-teal-400">{log.action}</td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-200">{log.entityType}</span>
                      {log.entityId && <span className="text-[10px] text-slate-400 font-mono block">ID: {log.entityId}</span>}
                    </td>
                    <td className="p-4 font-mono text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="p-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          log.resultStatus === 'SUCCESS'
                            ? 'bg-teal-950 text-teal-300 border border-teal-500/40'
                            : 'bg-red-950 text-red-300 border border-red-500/40'
                        }`}
                      >
                        {log.resultStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page <span className="font-bold text-slate-200">{pagination.page}</span> of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold"
                >
                  Previous
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
