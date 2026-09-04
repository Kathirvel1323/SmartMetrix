import React, { useState, useEffect } from 'react';
import { instrumentService } from '../../services/instrument.service';
import type { Instrument } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { Plus, RefreshCw, Eye } from 'lucide-react';
import { RegisterInstrumentModal } from '../../components/modals/RegisterInstrumentModal';
import { InstrumentDetailModal } from '../../components/modals/InstrumentDetailModal';
import { RequestVerificationModal } from '../../components/modals/RequestVerificationModal';

export const InstrumentsPage: React.FC = () => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);
  const [requestVerificationTarget, setRequestVerificationTarget] = useState<Instrument | null>(null);

  const fetchInstruments = async () => {
    setIsLoading(true);
    try {
      const res = await instrumentService.getInstruments({
        search,
        type: typeFilter,
        page,
        limit: 10,
      });
      setInstruments(res.instruments);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setInstruments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstruments();
  }, [page, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInstruments();
  };

  const columns: Column<Instrument>[] = [
    {
      header: 'Instrument ID',
      accessor: (item) => (
        <span className="font-mono font-bold text-teal-400">{item.instrumentId}</span>
      ),
    },
    {
      header: 'Instrument Name',
      accessor: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-400">{item.manufacturer} • {item.modelNumber}</div>
        </div>
      ),
    },
    {
      header: 'Type & Capacity',
      accessor: (item) => (
        <span className="text-xs text-slate-300">
          {item.type} ({item.capacityValue} {item.capacityUnit})
        </span>
      ),
    },
    {
      header: 'Serial No.',
      accessor: (item) => <span className="font-mono text-xs text-slate-400">{item.serialNumber}</span>,
    },
    {
      header: 'Location',
      accessor: (item) => (
        <span className="text-xs text-slate-300">
          {item.location?.city || item.location?.district || 'Regional'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (item) => (
        <Badge variant={item.verificationStatus === 'VERIFIED' ? 'pass' : 'pending'}>
          {item.verificationStatus || 'PENDING'}
        </Badge>
      ),
    },
    {
      header: 'Action',
      accessor: (item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedInstrumentId(item._id || item.instrumentId);
          }}
          icon={<Eye className="w-3.5 h-3.5 text-teal-400" />}
        >
          Passport
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Legal Metrology Instruments"
        subtitle="Registered measuring instruments, digital passports & compliance state."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Instruments' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Register Instrument
          </Button>
        }
      />

      <Card className="mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by instrument ID, name, or serial..."
            className="w-full sm:w-80"
          />
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { label: 'All Instrument Types', value: '' },
              { label: 'Weighing Scale', value: 'WEIGHING_SCALE' },
              { label: 'Fuel Pump', value: 'FUEL_PUMP' },
              { label: 'Flow Meter', value: 'FLOW_METER' },
              { label: 'Length Measure', value: 'LENGTH_MEASURE' },
            ]}
            className="w-full sm:w-56"
          />
          <Button type="submit" variant="secondary" size="md" icon={<RefreshCw className="w-4 h-4" />}>
            Filter
          </Button>
        </form>
      </Card>

      <DataTable
        columns={columns}
        data={instruments}
        isLoading={isLoading}
        emptyTitle="No Legal Metrology Instruments Registered"
        emptyDescription="No instruments match your current filter settings."
        keyExtractor={(item) => item._id || item.instrumentId}
        onRowClick={(item) => setSelectedInstrumentId(item._id || item.instrumentId)}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
      />

      {/* Modals Integration */}
      <RegisterInstrumentModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={fetchInstruments}
      />

      <InstrumentDetailModal
        isOpen={!!selectedInstrumentId}
        instrumentId={selectedInstrumentId}
        onClose={() => setSelectedInstrumentId(null)}
        onRequestVerification={(inst) => setRequestVerificationTarget(inst)}
      />

      <RequestVerificationModal
        isOpen={!!requestVerificationTarget}
        preselectedInstrument={requestVerificationTarget}
        onClose={() => setRequestVerificationTarget(null)}
        onSuccess={fetchInstruments}
      />
    </div>
  );
};
