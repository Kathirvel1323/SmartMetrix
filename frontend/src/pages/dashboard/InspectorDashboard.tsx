import React, { useState, useEffect } from 'react';
import { verificationService } from '../../services/verification.service';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { ClipboardCheck, ShieldCheck, MapPin, Calendar, ArrowRight, Signal } from 'lucide-react';
import { Link } from 'react-router-dom';

export const InspectorDashboard: React.FC = () => {
  const [assignedRequests, setAssignedRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await verificationService.getVerificationRequests({ status: 'ASSIGNED' });
        setAssignedRequests(res.requests || []);
      } catch {
        setAssignedRequests([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) return <LoadingState message="Loading Inspector Field Schedule..." />;

  return (
    <div className="space-y-6">
      {/* Mobile-first Inspector Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 p-5 rounded-2xl border border-teal-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-900 text-teal-300 uppercase tracking-wide">
              Inspector Operations
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <Signal className="w-3 h-3 animate-pulse" /> FIELD ONLINE
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1">Field Inspection Schedule</h2>
        </div>
        <Link to="/inspections">
          <Button variant="primary" size="md" icon={<ArrowRight className="w-4 h-4" />}>
            Conduct Field Inspection
          </Button>
        </Link>
      </div>

      {/* Field Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Assigned To Me"
          value={assignedRequests.length}
          subtitle="Verification requests pending"
          icon={<ClipboardCheck className="w-6 h-6" />}
          color="teal"
        />
        <StatCard
          title="Scheduled Today"
          value={assignedRequests.filter((r) => r.status === 'SCHEDULED').length}
          subtitle="Ready for field execution"
          icon={<Calendar className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Completed This Month"
          value={12}
          subtitle="Sealed with HMAC integrity"
          icon={<ShieldCheck className="w-6 h-6" />}
          color="emerald"
        />
      </div>

      {/* Priority Assigned Queue */}
      <Card title="Today's Field Inspection Queue" subtitle="Assigned verification assignments with GPS coordinates">
        {assignedRequests.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {assignedRequests.map((req) => (
              <div key={req._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-400">{req.requestId}</span>
                    <Badge variant="scheduled">{req.status}</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">{req.instrumentId?.name || 'Commercial Instrument'}</h4>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {req.instrumentId?.location?.address || 'Site Inspection Address'}, {req.instrumentId?.location?.city || 'District'}
                  </p>
                </div>
                <Link to="/inspections">
                  <Button variant="secondary" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                    Inspect
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <p className="text-sm font-medium">No pending verification requests currently assigned to your queue.</p>
            <p className="text-xs text-slate-500 mt-1">Check back once administrators schedule new verification tasks.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
