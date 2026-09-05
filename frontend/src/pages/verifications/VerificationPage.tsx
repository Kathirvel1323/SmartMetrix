import React, { useState, useEffect } from 'react';
import { verificationService } from '../../services/verification.service';
import type { VerificationRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Select';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { Send, UserCheck, ClipboardCheck } from 'lucide-react';
import { RequestVerificationModal } from '../../components/modals/RequestVerificationModal';
import { AssignInspectorModal } from '../../components/modals/AssignInspectorModal';
import { ConductInspectionModal } from '../../components/modals/ConductInspectionModal';

export const VerificationPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<VerificationRequest | null>(null);
  const [conductTarget, setConductTarget] = useState<VerificationRequest | null>(null);

  const fetchVerifications = async () => {
    setIsLoading(true);
    try {
      const res = await verificationService.getVerificationRequests({
        status: statusFilter,
        page,
        limit: 10,
      });
      setRequests(res.requests);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [page, statusFilter]);

  const getStatusBadgeVariant = (status: string): BadgeVariant => {
    switch (status) {
      case 'PASSED':
        return 'pass';
      case 'FAILED':
        return 'fail';
      case 'SCHEDULED':
      case 'ASSIGNED':
        return 'scheduled';
      case 'UNDER_REVIEW':
        return 'review';
      default:
        return 'pending';
    }
  };

  const columns: Column<VerificationRequest>[] = [
    {
      header: 'Request ID',
      accessor: (item) => (
        <span className="font-mono font-bold text-teal-400">{item.requestId}</span>
      ),
    },
    {
      header: 'Instrument',
      accessor: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.instrument?.manufacturer} {item.instrument?.model}</div>
          <div className="text-xs text-slate-400">ID: {item.instrument?.instrumentId || 'N/A'}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (item) => (
        <Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge>
      ),
    },
    {
      header: 'Assigned Inspector',
      accessor: (item) => (
        <span className="text-xs text-slate-300">
          {item.assignedInspector?.name || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Date Created',
      accessor: (item) => (
        <span className="text-xs text-slate-400 font-mono">
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Today'}
        </span>
      ),
    },
    {
      header: 'Workflow Actions',
      accessor: (item) => (
        <div className="flex items-center gap-2">
          {user?.role === 'ADMIN' && (item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW' || item.status === 'ASSIGNED') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignTarget(item)}
              icon={<UserCheck className="w-3.5 h-3.5 text-purple-400" />}
            >
              Assign & Schedule
            </Button>
          )}

          {user?.role === 'INSPECTOR' && item.status === 'SCHEDULED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConductTarget(item)}
              icon={<ClipboardCheck className="w-3.5 h-3.5" />}
            >
              Conduct Inspection
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Verification Requests"
        subtitle="Track submitted legal metrology verification applications & scheduling status."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Verification' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRequestModalOpen(true)}
            icon={<Send className="w-4 h-4" />}
          >
            Request Verification
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { label: 'All Statuses', value: '' },
              { label: 'Submitted', value: 'SUBMITTED' },
              { label: 'Under Review', value: 'UNDER_REVIEW' },
              { label: 'Assigned', value: 'ASSIGNED' },
              { label: 'Scheduled', value: 'SCHEDULED' },
              { label: 'Passed', value: 'PASSED' },
              { label: 'Failed', value: 'FAILED' },
              { label: 'Certificate Issued', value: 'CERTIFICATE_ISSUED' },
            ]}
            className="w-full sm:w-64"
          />
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        emptyTitle="No Verification Requests Found"
        emptyDescription="There are no verification applications matching your criteria."
        keyExtractor={(item) => item._id || item.requestId}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
      />

      {/* Modals Integration */}
      <RequestVerificationModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={fetchVerifications}
      />

      <AssignInspectorModal
        isOpen={!!assignTarget}
        request={assignTarget}
        onClose={() => setAssignTarget(null)}
        onSuccess={fetchVerifications}
      />

      <ConductInspectionModal
        isOpen={!!conductTarget}
        verificationRequest={conductTarget}
        onClose={() => setConductTarget(null)}
        onSuccess={fetchVerifications}
      />
    </div>
  );
};
