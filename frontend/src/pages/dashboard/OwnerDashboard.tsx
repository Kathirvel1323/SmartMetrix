import React, { useState, useEffect } from 'react';
import { instrumentService } from '../../services/instrument.service';
import { verificationService } from '../../services/verification.service';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { Scale, ClipboardCheck, FileCheck2, PlusCircle, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export const OwnerDashboard: React.FC = () => {
  const [instruments, setInstruments] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [instRes, verifRes] = await Promise.allSettled([
          instrumentService.getInstruments(),
          verificationService.getVerificationRequests(),
        ]);
        if (instRes.status === 'fulfilled') setInstruments(instRes.value.instruments || []);
        if (verifRes.status === 'fulfilled') setVerifications(verifRes.value.requests || []);
      } catch {
        setInstruments([]);
        setVerifications([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) return <LoadingState message="Loading Establishment Assets & Certificates..." />;

  const verifiedCount = instruments.filter((i) => i.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Reassuring Owner Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950/50 p-5 rounded-2xl border border-sky-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">
            Establishment Owner Portal
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">Asset Compliance Overview</h2>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/instruments">
            <Button variant="secondary" size="sm" icon={<PlusCircle className="w-4 h-4" />}>
              Register Instrument
            </Button>
          </Link>
          <Link to="/verifications">
            <Button variant="primary" size="sm" icon={<Send className="w-4 h-4" />}>
              Request Verification
            </Button>
          </Link>
        </div>
      </div>

      {/* Owner Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Registered Instruments"
          value={instruments.length}
          subtitle="Legal metrology assets"
          icon={<Scale className="w-6 h-6" />}
          color="sky"
        />
        <StatCard
          title="Verified Status"
          value={verifiedCount}
          subtitle="Active legal compliance"
          icon={<FileCheck2 className="w-6 h-6" />}
          color="emerald"
        />
        <StatCard
          title="Active Verification Requests"
          value={verifications.length}
          subtitle="In pipeline"
          icon={<ClipboardCheck className="w-6 h-6" />}
          color="amber"
        />
      </div>

      {/* Instruments List Card */}
      <Card
        title="My Legal Metrology Instruments"
        subtitle="Registered measuring instruments and current verification state"
        action={
          <Link to="/instruments">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        }
      >
        {instruments.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {instruments.slice(0, 5).map((inst) => (
              <div key={inst._id} className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{inst.manufacturer} {inst.model}</h4>
                  <p className="text-xs text-slate-400">
                    {inst.type} • Serial: <span className="font-mono">{inst.serialNumber}</span>
                  </p>
                </div>
                <Badge variant={inst.status === 'ACTIVE' ? 'pass' : 'pending'}>
                  {inst.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <p className="text-sm font-medium">No instruments registered under your account yet.</p>
            <p className="text-xs text-slate-500 mt-1">Click "Register Instrument" above to add your weighing scales or metering devices.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
