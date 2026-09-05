import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { LoadingState } from '../ui/LoadingState';
import { inspectionService } from '../../services/inspection.service';
import type { Inspection } from '../../types';
import { ShieldCheck, MapPin, FileText, AlertCircle, Camera } from 'lucide-react';

interface InspectionDetailModalProps {
  isOpen: boolean;
  inspectionId: string | null;
  onClose: () => void;
}

export const InspectionDetailModal: React.FC<InspectionDetailModalProps> = ({
  isOpen,
  inspectionId,
  onClose,
}) => {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && inspectionId) {
      fetchInspection(inspectionId);
    }
  }, [isOpen, inspectionId]);

  const fetchInspection = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await inspectionService.getInspectionById(id);
      setInspection(data);
    } catch {
      setInspection(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Field Inspection Audit Report"
      subtitle="Official Legal Metrology field inspection record"
      maxWidth="3xl"
    >
      {isLoading ? (
        <LoadingState message="Retrieving field inspection audit record..." />
      ) : inspection ? (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-teal-400 font-bold uppercase tracking-wider">
                ID: {inspection.inspectionId}
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {inspection.instrument?.manufacturer} {inspection.instrument?.model || inspection.instrumentIdSnapshot}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Logged at: {inspection.createdAt ? new Date(inspection.createdAt).toLocaleString() : 'Recent'}
              </p>
            </div>

            <Badge variant={inspection.inspectorResult === 'PASS' ? 'pass' : 'fail'}>
              VERDICT: {inspection.inspectorResult}
            </Badge>
          </div>

          {/* Measurements Breakdown Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Reference Standard</span>
              <div className="text-lg font-mono font-bold text-slate-100 mt-1">
                {inspection.referenceReading} {inspection.toleranceSnapshot?.capacityUnit}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-semibold uppercase">Observed Field Reading</span>
              <div className="text-lg font-mono font-bold text-slate-100 mt-1">
                {inspection.actualReading} {inspection.toleranceSnapshot?.capacityUnit}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-lg border border-teal-500/30">
              <span className="text-[11px] text-teal-400 font-semibold uppercase">Tolerance Deviation</span>
              <div className="text-lg font-mono font-bold text-teal-300 mt-1">
                {inspection.deviation} {inspection.toleranceSnapshot?.capacityUnit}
              </div>
            </div>
          </div>

          {/* Assessment & Override Details */}
          {inspection.overrideReason && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl space-y-1">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Inspector Assessment Override Recorded
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {inspection.overrideReason}
              </p>
            </div>
          )}

          {/* GPS Coordinates & Inspector Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                GPS Geo-Tagging Location
              </h4>
              <p className="text-xs font-mono text-slate-300">
                Latitude: {inspection.gps?.coordinates ? inspection.gps.coordinates[1].toFixed(6) : 'Not captured'}
              </p>
              <p className="text-xs font-mono text-slate-300">
                Longitude: {inspection.gps?.coordinates ? inspection.gps.coordinates[0].toFixed(6) : 'Not captured'}
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                Inspector Verification Credentials
              </h4>
              <p className="text-xs text-slate-300">
                Inspector: <span className="font-semibold text-slate-100">{inspection.inspector?.name || 'Not available'}</span>
              </p>
              <p className="text-xs text-slate-400">
                Email: {inspection.inspector?.email || 'Not available'}
              </p>
            </div>
          </div>

          {/* Stored audit record indicator */}
          <div className="p-4 bg-slate-900 border border-teal-500/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h5 className="text-xs font-bold text-slate-100">Stored Statutory Inspection Audit Record</h5>
                <p className="text-[11px] text-slate-400 font-mono">
                  Official Verification ID: {inspection.inspectionId}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold rounded-lg uppercase">
              FINALIZED
            </span>
          </div>

          {/* Evidence Attachments */}
          {inspection.evidence && inspection.evidence.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-teal-400" />
                Attached Evidence Files ({inspection.evidence.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {inspection.evidence.map((file, idx) => (
                  <div key={file.evidenceId} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-center">
                    <span className="text-[11px] text-teal-400 font-mono truncate block">
                      Attachment #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-6">Inspection report unavailable.</p>
      )}
    </Modal>
  );
};
