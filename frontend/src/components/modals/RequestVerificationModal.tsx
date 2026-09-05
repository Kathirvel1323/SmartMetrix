import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { verificationService } from '../../services/verification.service';
import { instrumentService } from '../../services/instrument.service';
import type { Instrument } from '../../types';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';

interface RequestVerificationModalProps {
  isOpen: boolean;
  preselectedInstrument?: Instrument | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestVerificationModal: React.FC<RequestVerificationModalProps> = ({
  isOpen,
  preselectedInstrument,
  onClose,
  onSuccess,
}) => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [notes, setNotes] = useState('');
  const [verificationType, setVerificationType] = useState<'INITIAL' | 'RE_VERIFICATION'>('INITIAL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadInstruments = useCallback(async () => {
    try {
      const res = await instrumentService.getInstruments({ limit: 50 });
      setInstruments(res.instruments);
      if (res.instruments.length > 0) {
        setSelectedInstrumentId((current) => current || res.instruments[0]._id || res.instruments[0].instrumentId);
      }
    } catch {
      setInstruments([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (preselectedInstrument) {
        setSelectedInstrumentId(preselectedInstrument._id || preselectedInstrument.instrumentId);
      } else {
        void loadInstruments();
      }
    }
  }, [isOpen, loadInstruments, preselectedInstrument]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!selectedInstrumentId) {
      setError('Please select an instrument to apply for verification.');
      return;
    }

    setIsLoading(true);
    try {
      await verificationService.createVerificationRequest({
        instrumentId: selectedInstrumentId,
        verificationType,
        remarks: notes,
      });

      setSuccessMessage('Verification request successfully submitted for review!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit verification request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Legal Verification"
      subtitle="Submit an official legal metrology verification application to the district inspectorate."
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {preselectedInstrument ? (
          <div className="p-3.5 bg-slate-950/80 border border-teal-500/30 rounded-xl">
            <span className="text-[11px] text-teal-400 font-semibold uppercase tracking-wider">
              Target Instrument
            </span>
            <h4 className="text-sm font-bold text-white">{preselectedInstrument.manufacturer} {preselectedInstrument.model}</h4>
            <p className="text-xs text-slate-400 font-mono">
              ID: {preselectedInstrument.instrumentId} • S/N: {preselectedInstrument.serialNumber}
            </p>
          </div>
        ) : (
          <Select
            label="Select Registered Instrument *"
            value={selectedInstrumentId}
            onChange={(e) => setSelectedInstrumentId(e.target.value)}
            options={instruments.map((inst) => ({
              label: `${inst.manufacturer} ${inst.model} (${inst.instrumentId} - ${inst.serialNumber})`,
              value: inst._id || inst.instrumentId,
            }))}
          />
        )}

        <Select
          label="Verification Type *"
          value={verificationType}
          onChange={(e) => setVerificationType(e.target.value as 'INITIAL' | 'RE_VERIFICATION')}
          options={[
            { label: 'Initial Verification', value: 'INITIAL' },
            { label: 'Re-verification', value: 'RE_VERIFICATION' },
          ]}
        />

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Application Notes / Specific Inspection Instructions
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Annual re-verification requested prior to commercial trade season."
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors"
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
            icon={<Send className="w-4 h-4" />}
          >
            Submit Application
          </Button>
        </div>
      </form>
    </Modal>
  );
};
