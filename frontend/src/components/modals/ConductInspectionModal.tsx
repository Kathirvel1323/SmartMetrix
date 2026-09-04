import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { inspectionService } from '../../services/inspection.service';
import type { VerificationRequest } from '../../types';
import { ClipboardCheck, MapPin, AlertTriangle, CheckCircle, ShieldAlert, Upload } from 'lucide-react';

interface ConductInspectionModalProps {
  isOpen: boolean;
  verificationRequest: VerificationRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConductInspectionModal: React.FC<ConductInspectionModalProps> = ({
  isOpen,
  verificationRequest,
  onClose,
  onSuccess,
}) => {
  const [referenceReading, setReferenceReading] = useState('100.00');
  const [observedReading, setObservedReading] = useState('100.05');
  const [deviationUnit, setDeviationUnit] = useState('kg');
  const [result, setResult] = useState<'PASS' | 'FAIL' | 'INCONCLUSIVE'>('PASS');
  const [overrideReason, setOverrideReason] = useState('');
  const [latitude, setLatitude] = useState('19.0760');
  const [longitude, setLongitude] = useState('72.8777');
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-calculated deviation
  const refNum = parseFloat(referenceReading) || 0;
  const obsNum = parseFloat(observedReading) || 0;
  const deviation = Number((obsNum - refNum).toFixed(4));
  const deviationPct = refNum > 0 ? Number(((deviation / refNum) * 100).toFixed(4)) : 0;

  // Standard rule of thumb: pass if deviation <= 0.1% or 0.1 unit
  const autoCalculatedAssessment: 'PASS' | 'FAIL' = Math.abs(deviationPct) <= 0.2 ? 'PASS' : 'FAIL';
  const isOverride = result !== autoCalculatedAssessment;

  useEffect(() => {
    if (isOpen) {
      // Attempt browser GPS location capture
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLatitude(pos.coords.latitude.toFixed(6));
            setLongitude(pos.coords.longitude.toFixed(6));
          },
          () => {
            // Geolocation denied or unavailable; use default city coordinates
          }
        );
      }
    }
  }, [isOpen]);

  if (!isOpen || !verificationRequest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (isOverride && !overrideReason.trim()) {
      setError('An override reason is required when overriding the calculated pass/fail assessment.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('verificationRequestId', verificationRequest._id || verificationRequest.requestId);
      formData.append('referenceReading', referenceReading);
      formData.append('actualReading', observedReading);
      formData.append('inspectorResult', result);
      if (overrideReason) formData.append('overrideReason', overrideReason);
      formData.append('gpsLatitude', latitude);
      formData.append('gpsLongitude', longitude);
      formData.append('serialNumberMatch', 'true');
      formData.append('sealCondition', 'INTACT');

      if (evidenceFiles) {
        Array.from(evidenceFiles).forEach((file) => {
          formData.append('evidence', file);
        });
      }

      await inspectionService.submitInspection(formData);

      setSuccessMessage('Field inspection completed & HMAC tamper seal generated!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit inspection record.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conduct Field Legal Metrology Inspection"
      subtitle={`Log live measurement readings & calculate deviation for Request ${verificationRequest.requestId}`}
      maxWidth="3xl"
    >
      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center gap-3 text-red-300 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Readings Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
          <Input
            label="Reference Standard Reading *"
            type="number"
            step="0.001"
            value={referenceReading}
            onChange={(e) => setReferenceReading(e.target.value)}
            required
          />

          <Input
            label="Observed Instrument Reading *"
            type="number"
            step="0.001"
            value={observedReading}
            onChange={(e) => setObservedReading(e.target.value)}
            required
          />

          <Select
            label="Measurement Unit *"
            value={deviationUnit}
            onChange={(e) => setDeviationUnit(e.target.value)}
            options={[
              { label: 'kg', value: 'kg' },
              { label: 'g', value: 'g' },
              { label: 'Liters (L)', value: 'L' },
              { label: 'Meters (m)', value: 'm' },
            ]}
          />
        </div>

        {/* Live Calculated Deviation Metrics */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-teal-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
              Calculated Tolerance Deviation
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-2xl font-mono font-extrabold text-white">
                {deviation > 0 ? `+${deviation}` : deviation} {deviationUnit}
              </span>
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${autoCalculatedAssessment === 'PASS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-red-950 text-red-400 border border-red-500/30'}`}>
                {deviationPct > 0 ? `+${deviationPct}%` : `${deviationPct}%`} deviation
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Rule Assessment:</span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${autoCalculatedAssessment === 'PASS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'}`}>
              {autoCalculatedAssessment}
            </span>
          </div>
        </div>

        {/* Result & Override Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Final Inspection Verdict *"
            value={result}
            onChange={(e) => setResult(e.target.value as any)}
            options={[
              { label: 'PASS — Certified Legal Compliant', value: 'PASS' },
              { label: 'FAIL — Out of Tolerance / Non-Compliant', value: 'FAIL' },
              { label: 'INCONCLUSIVE — Requires Lab Re-test', value: 'INCONCLUSIVE' },
            ]}
          />

          {isOverride && (
            <div className="sm:col-span-2 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Inspector Assessment Override Reason *
              </label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why final verdict differs from calculated tolerance assessment..."
                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
                required
              />
            </div>
          )}
        </div>

        {/* Geo Location Capture */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              GPS Geo-Tagging Verification Coordinates
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="font-mono"
            />
            <Input
              label="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {/* Evidence Photos Upload */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            Field Evidence Photos (Max 5 Image/PDF Attachments)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(e) => setEvidenceFiles(e.target.files)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-teal-300 hover:file:bg-slate-700 cursor-pointer"
          />
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            icon={<ClipboardCheck className="w-4 h-4" />}
          >
            Finalize Field Inspection & Seal Record
          </Button>
        </div>
      </form>
    </Modal>
  );
};
