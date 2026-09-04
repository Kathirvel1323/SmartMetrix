import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { Download, FileSpreadsheet, FileText, AlertTriangle, ShieldAlert, Map, QrCode } from 'lucide-react';
import { apiClient } from '../../services/api';

type ReportType =
  | 'instruments'
  | 'verifications'
  | 'inspections'
  | 'high-risk'
  | 'regional-risk'
  | 'anomalies'
  | 'certificate-expiry'
  | 'improvement-notices';

type Format = 'pdf' | 'csv';

interface ReportConfig {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  roles: Array<'ADMIN' | 'INSPECTOR' | 'OWNER'>;
}

const REPORTS: ReportConfig[] = [
  {
    type: 'instruments',
    title: 'Instruments Registry Report',
    description: 'Complete list of all registered instruments with categories, manufacturers, cities and verification status.',
    icon: <FileText className="w-5 h-5 text-teal-400" />,
    roles: ['ADMIN', 'INSPECTOR', 'OWNER'],
  },
  {
    type: 'verifications',
    title: 'Verification Requests Report',
    description: 'All verification requests with types, statuses, scheduled dates and inspector assignments.',
    icon: <FileSpreadsheet className="w-5 h-5 text-sky-400" />,
    roles: ['ADMIN', 'INSPECTOR', 'OWNER'],
  },
  {
    type: 'inspections',
    title: 'Field Inspections Audit Report',
    description: 'All completed field inspections with PASS/FAIL results, deviations and GPS coordinates.',
    icon: <FileText className="w-5 h-5 text-emerald-400" />,
    roles: ['ADMIN', 'INSPECTOR'],
  },
  {
    type: 'high-risk',
    title: 'High Risk Assessment Report',
    description: 'Instruments classified HIGH or CRITICAL risk by the Isolation Forest model — decision support output.',
    icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
    roles: ['ADMIN', 'INSPECTOR'],
  },
  {
    type: 'regional-risk',
    title: 'Regional Cluster Report',
    description: '"Potential Cluster" and "Correlation" patterns detected by Haversine proximity analysis.',
    icon: <Map className="w-5 h-5 text-purple-400" />,
    roles: ['ADMIN', 'INSPECTOR'],
  },
  {
    type: 'anomalies',
    title: 'Potential Anomaly Report',
    description: 'Instruments with potentialAnomaly === true in their latest AI assessment. Decision support only.',
    icon: <ShieldAlert className="w-5 h-5 text-amber-400" />,
    roles: ['ADMIN', 'INSPECTOR'],
  },
  {
    type: 'certificate-expiry',
    title: 'Certificate Expiry Report',
    description: 'Digital certificates sorted by expiry date — useful for renewal scheduling and compliance monitoring.',
    icon: <QrCode className="w-5 h-5 text-teal-400" />,
    roles: ['ADMIN', 'INSPECTOR', 'OWNER'],
  },
  {
    type: 'improvement-notices',
    title: 'Improvement Notices Report',
    description: 'All statutory enforcement orders with statuses, deadlines and required corrections.',
    icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
    roles: ['ADMIN', 'INSPECTOR', 'OWNER'],
  },
];

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState<`${ReportType}-${Format}` | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const triggerDownload = async (reportType: ReportType, format: Format) => {
    const key = `${reportType}-${format}` as const;
    setDownloading(key);
    setMessages((prev) => ({ ...prev, [key]: '' }));

    try {
      const response = await apiClient.get(`/reports/${reportType}`, {
        params: { format },
        responseType: 'blob',
      });

      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const blob = new Blob([response.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `smartmetrix_${reportType}_${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setMessages((prev) => ({ ...prev, [key]: `✓ Downloaded successfully` }));
    } catch (err: any) {
      const msg =
        err.response?.status === 403
          ? 'Access denied for your role.'
          : err.response?.status === 404
          ? 'No data available for this report type yet.'
          : 'Download failed. Please try again.';
      setMessages((prev) => ({ ...prev, [key]: `✗ ${msg}` }));
    } finally {
      setDownloading(null);
    }
  };

  const visibleReports = REPORTS.filter((r) =>
    !user || r.roles.includes(user.role as any)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="PDF & CSV Report Generator"
        subtitle="Generate streaming reports from live MongoDB data. All reports are scoped to your role and produce tamper-evident outputs."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Reports' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleReports.map((report) => {
          const pdfKey = `${report.type}-pdf` as const;
          const csvKey = `${report.type}-csv` as const;
          const pdfMessage = messages[pdfKey];
          const csvMessage = messages[csvKey];

          return (
            <Card key={report.type}>
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 shrink-0">
                  {report.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{report.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{report.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  isLoading={downloading === pdfKey}
                  onClick={() => triggerDownload(report.type, 'pdf')}
                >
                  PDF Report
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                  isLoading={downloading === csvKey}
                  onClick={() => triggerDownload(report.type, 'csv')}
                >
                  CSV Dataset
                </Button>
              </div>

              {(pdfMessage || csvMessage) && (
                <p
                  className={`text-[11px] mt-2 font-semibold ${
                    (pdfMessage || csvMessage)?.startsWith('✓')
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {pdfMessage || csvMessage}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-amber-400">Report Access Notice:</span>{' '}
            Reports labelled "high-risk", "regional-risk" and "anomalies" are restricted to ADMIN and INSPECTOR roles.
            All AI-derived data in reports is decision support only — not a confirmation of fraud, defect, or legal violation.
            Final enforcement authority remains exclusively with the authorized Legal Metrology Officer.
          </p>
        </div>
      </Card>
    </div>
  );
};
