import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingState } from '../ui/LoadingState';
import { instrumentService } from '../../services/instrument.service';
import type { Instrument } from '../../types';
import { Scale, QrCode, ShieldCheck, MapPin, FileText, Send } from 'lucide-react';

interface InstrumentDetailModalProps {
  isOpen: boolean;
  instrumentId: string | null;
  onClose: () => void;
  onRequestVerification?: (instrument: Instrument) => void;
}

export const InstrumentDetailModal: React.FC<InstrumentDetailModalProps> = ({
  isOpen,
  instrumentId,
  onClose,
  onRequestVerification,
}) => {
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [passportData, setPassportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const [inst, pass] = await Promise.allSettled([
        instrumentService.getInstrumentById(id),
        instrumentService.getInstrumentPassport(id),
      ]);

      if (inst.status === 'fulfilled') setInstrument(inst.value);
      if (pass.status === 'fulfilled') setPassportData(pass.value);
    } catch {
      // Fallback state handles error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && instrumentId) {
      fetchDetails(instrumentId);
    }
  }, [isOpen, instrumentId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Legal Metrology Digital Passport"
      subtitle="Government Tamper-Proof Instrument Passport & Compliance Life Cycle"
      maxWidth="3xl"
    >
      {isLoading ? (
        <LoadingState message="Fetching Digital Passport data from the SmartMetrix registry..." />
      ) : instrument ? (
        <div className="space-y-6">
          {/* Header Badge Box */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-teal-950/60 p-5 rounded-xl border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-950 border border-teal-500/40 rounded-xl text-teal-400">
                <Scale className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-mono text-teal-400 font-bold uppercase tracking-wider">
                  ID: {instrument.instrumentId}
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">{instrument.manufacturer} {instrument.model}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Serial: {instrument.serialNumber}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={instrument.status === 'ACTIVE' ? 'pass' : 'pending'}>
                {instrument.status}
              </Badge>
              <span className="text-[10px] text-slate-400 font-mono">
                Issued: {instrument.createdAt ? new Date(instrument.createdAt).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>

          {/* Specifications Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                Technical Specifications
              </h4>
              <div className="text-xs space-y-2 text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Classification:</span>
                  <span className="font-semibold">{instrument.type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Category:</span>
                  <span>{instrument.category || 'Commercial Metrology'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Serial Number:</span>
                  <span className="font-mono text-teal-300">{instrument.serialNumber}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Max Capacity:</span>
                  <span className="font-semibold text-emerald-400">
                    {instrument.capacity?.value} {instrument.capacity?.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                Geographic Installation
              </h4>
              <div className="text-xs space-y-2 text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Address:</span>
                  <span className="text-right">{instrument.location?.address || 'Main Facility'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">City / District:</span>
                  <span>
                    {instrument.location?.city || 'City'}, {instrument.location?.district || 'District'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">State & Pincode:</span>
                  <span>
                    {instrument.location?.state || 'State'} - {instrument.location?.pincode || '400001'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">GPS Coordinates:</span>
                  <span className="font-mono text-xs text-sky-400">
                    {instrument.location?.coordinates?.coordinates
                      ? `${instrument.location.coordinates.coordinates[1]}, ${instrument.location.coordinates.coordinates[0]}`
                      : 'Not recorded'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code & HMAC Integrity Box */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-lg text-slate-950 shrink-0">
                <QrCode className="w-10 h-10" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Digital QR Integrity Seal
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Scan QR code on physical instrument sticker to verify instant authenticity.
                </p>
                {(passportData?.hash || passportData?.certificateHash || passportData?.qrCodeHash) && (
                  <div className="font-mono text-[10px] text-teal-400/80 mt-1 truncate max-w-sm">
                    Hash Seal: {passportData.hash || passportData.certificateHash || passportData.qrCodeHash}
                  </div>
                )}
              </div>
            </div>

            {onRequestVerification && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onRequestVerification(instrument);
                }}
                icon={<Send className="w-4 h-4" />}
              >
                Request Verification
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-6">Instrument details unavailable.</p>
      )}
    </Modal>
  );
};
