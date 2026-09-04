import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Calendar } from 'lucide-react';

export const NoticesPage: React.FC = () => {
  const notices = [
    {
      id: 'IMP-2026-0012',
      instrument: 'Non-Automatic Scale #102',
      reason: 'Observed deviation (+1.25%) exceeds statutory tolerance limit.',
      deadline: '2026-09-30',
      status: 'ISSUED',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Improvement Notices"
        subtitle="Enforcement orders issued for non-compliant measuring instruments."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Improvement Notices' }]}
      />

      <Card title="Active Enforcement Orders" subtitle="Notices requiring recalibration or repair before re-inspection">
        {notices.map((n) => (
          <div key={n.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-400">{n.id}</span>
              <Badge variant="pending">{n.status}</Badge>
            </div>
            <h4 className="text-sm font-bold text-slate-100">{n.instrument}</h4>
            <p className="text-xs text-slate-300">{n.reason}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono pt-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> Statutory Deadline: {n.deadline}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};
