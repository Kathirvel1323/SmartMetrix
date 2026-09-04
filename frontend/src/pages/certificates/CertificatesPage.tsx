import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ShieldCheck, QrCode, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const CertificatesPage: React.FC = () => {
  const sampleCertificates = [
    { id: 'CRT-2026-00891', instrument: 'Electronic Weighbridge 50T', issueDate: '2026-08-15', expiryDate: '2027-08-14', status: 'ACTIVE' },
    { id: 'CRT-2026-00412', instrument: 'Fuel Dispensing Unit #4', issueDate: '2026-06-10', expiryDate: '2027-06-09', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-Evident Digital Certificates"
        subtitle="HMAC-SHA256 crypto sealed verification seals with public QR code validation."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Digital Passport & Certificates' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sampleCertificates.map((cert) => (
          <Card key={cert.id} className="relative overflow-hidden border-teal-500/30">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest">
                  HMAC INTEGRITY SEALED
                </span>
                <h3 className="text-lg font-extrabold text-white mt-1">{cert.id}</h3>
                <p className="text-xs text-slate-300 font-medium">{cert.instrument}</p>
              </div>
              <Badge variant="pass">{cert.status}</Badge>
            </div>

            <div className="my-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">VALIDITY PERIOD</span>
                <span className="text-slate-200 font-mono">{cert.issueDate} → {cert.expiryDate}</span>
              </div>
              <QrCode className="w-10 h-10 text-teal-400 bg-slate-800 p-1.5 rounded-lg border border-slate-700" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Government Sealed
              </span>
              <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
                Download PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
