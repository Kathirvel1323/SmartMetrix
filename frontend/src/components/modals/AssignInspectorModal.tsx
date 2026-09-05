import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { verificationService } from '../../services/verification.service';
import type { VerificationRequest } from '../../types';
import { UserCheck, AlertCircle, CheckCircle } from 'lucide-react';

interface AssignInspectorModalProps {
  isOpen: boolean;
  request: VerificationRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignInspectorModal: React.FC<AssignInspectorModalProps> = ({
  isOpen,
  request,
  onClose,
  onSuccess,
}) => {
  const [inspectorId, setInspectorId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState('60');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen || !request) return null;

  const handleAssignAndSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const id = request.requestId;

      // 1. Review status transition if SUBMITTED
      if (request.status === 'SUBMITTED') {
        await verificationService.reviewVerificationRequest(id);
      }

      // 2. Assign inspector if inspectorId is supplied
      if (inspectorId) {
        await verificationService.assignInspector(id, { inspectorId });
      }

      // 3. Schedule inspection date & duration
      await verificationService.scheduleVerification(id, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        estimatedDurationMinutes: Number(duration),
      });

      setSuccessMessage('Inspector successfully assigned and inspection scheduled!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete assignment and scheduling workflow.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Inspector & Schedule Verification"
      subtitle={`Configure dispatch workflow for Verification Request ${request.requestId}`}
      maxWidth="lg"
    >
      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center gap-3 text-red-300 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleAssignAndSchedule} className="space-y-4">
        {/* Request summary badge */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-400">Target Instrument:</span>
            <span className="ml-1.5 font-semibold text-slate-100">{request.instrument?.manufacturer} {request.instrument?.model}</span>
          </div>
          <div>
            <span className="text-slate-400">Current Status:</span>
            <span className="ml-1.5 font-bold text-teal-400">{request.status}</span>
          </div>
        </div>

        <Input
          label="Inspector User ID / Mongo ID *"
          placeholder="e.g. 64b8f... or select field officer"
          value={inspectorId}
          onChange={(e) => setInspectorId(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Scheduled Date & Time *"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />

          <Input
            label="Estimated Duration (Minutes)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
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
            icon={<UserCheck className="w-4 h-4" />}
          >
            Confirm Assignment & Schedule
          </Button>
        </div>
      </form>
    </Modal>
  );
};
