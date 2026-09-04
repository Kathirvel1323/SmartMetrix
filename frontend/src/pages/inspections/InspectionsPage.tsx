import React, { useState, useEffect } from 'react';
import { inspectionService } from '../../services/inspection.service';
import type { Inspection } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { MapPin, Eye } from 'lucide-react';
import { InspectionDetailModal } from '../../components/modals/InspectionDetailModal';

export const InspectionsPage: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resultFilter, setResultFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  const fetchInspections = async () => {
    setIsLoading(true);
    try {
      const res = await inspectionService.getInspections({
        result: resultFilter,
        page,
        limit: 10,
      });
      setInspections(res.inspections);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setInspections([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [page, resultFilter]);

  const columns: Column<Inspection>[] = [
    {
      header: 'Inspection ID',
      accessor: (item) => (
        <span className="font-mono font-bold text-teal-400">{item.inspectionId}</span>
      ),
    },
    {
      header: 'Instrument',
      accessor: (item) => (
        <span className="font-semibold text-slate-100">{item.instrumentId?.name || 'Weighing Scale'}</span>
      ),
    },
    {
      header: 'Result',
      accessor: (item) => (
        <Badge variant={item.result === 'PASS' ? 'pass' : 'fail'}>{item.result}</Badge>
      ),
    },
    {
      header: 'Deviation',
      accessor: (item) => (
        <span className="font-mono text-xs text-slate-300">
          {item.deviationValue !== undefined ? `${item.deviationValue} ${item.deviationUnit || 'kg'}` : '0.00'}
        </span>
      ),
    },
    {
      header: 'GPS Location',
      accessor: (item) => (
        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
          <MapPin className="w-3 h-3 text-teal-400" />
          {item.gpsLocation?.latitude?.toFixed(2)}, {item.gpsLocation?.longitude?.toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Audit Trail',
      accessor: (item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedInspectionId(item._id || item.inspectionId);
          }}
          icon={<Eye className="w-3.5 h-3.5 text-teal-400" />}
        >
          View Report
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Field Inspection Audit Trail"
        subtitle="Completed field measurements, calculated tolerance deviations & HMAC tamper seals."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Inspections' }]}
      />

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { label: 'All Results', value: '' },
              { label: 'Pass', value: 'PASS' },
              { label: 'Fail', value: 'FAIL' },
              { label: 'Inconclusive', value: 'INCONCLUSIVE' },
            ]}
            className="w-full sm:w-64"
          />
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={inspections}
        isLoading={isLoading}
        emptyTitle="No Inspection Records Found"
        emptyDescription="There are no completed field inspection reports currently logged."
        keyExtractor={(item) => item._id || item.inspectionId}
        onRowClick={(item) => setSelectedInspectionId(item._id || item.inspectionId)}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
      />

      {/* Modal */}
      <InspectionDetailModal
        isOpen={!!selectedInspectionId}
        inspectionId={selectedInspectionId}
        onClose={() => setSelectedInspectionId(null)}
      />
    </div>
  );
};
