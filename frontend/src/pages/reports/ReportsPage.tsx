import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, FileSpreadsheet } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="PDF & CSV Executive Reports"
        subtitle="Generate streaming PDF verification summaries & structured CSV dataset exports."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Reports' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Monthly Executive PDF Report" subtitle="Official state compliance summary document">
          <p className="text-xs text-slate-400 mb-4">
            Includes total verification counts, compliance pass rates, risk distributions, and inspector activity logs.
          </p>
          <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />}>
            Download PDF Report
          </Button>
        </Card>

        <Card title="Raw Inspection Data Export (CSV)" subtitle="Complete tabular dataset export">
          <p className="text-xs text-slate-400 mb-4">
            Export raw field readings, GPS coordinates, calculated deviations, and HMAC seals for auditing.
          </p>
          <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="w-4 h-4" />}>
            Export CSV Dataset
          </Button>
        </Card>
      </div>
    </div>
  );
};
