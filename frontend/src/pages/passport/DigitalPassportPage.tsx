import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { instrumentService } from '../../services/instrument.service';
import { verificationService } from '../../services/verification.service';
import { certificateService } from '../../services/certificate.service';
import type { Instrument, Certificate, VerificationRequest } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Scale, ShieldCheck, History, Award, QrCode, ExternalLink, Building, AlertTriangle } from 'lucide-react';
import { publicService } from '../../services/public.service';

export const DigitalPassportPage: React.FC = () => {
  const { instrumentId } = useParams<{ instrumentId?: string }>();
  const navigate = useNavigate();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedId, setSelectedId] = useState<string>(instrumentId || '');
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  // Fetch initial instrument list
  useEffect(() => {
    instrumentService
      .getInstruments()
      .then((res: any) => {
        const list = res.instruments || res || [];
        setInstruments(list);
        if (list.length > 0) {
          setSelectedId((current) => current || list[0].instrumentId);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch details for selected instrument
  useEffect(() => {
    if (!selectedId) return;
    setIsLoading(true);

    Promise.all([
      instrumentService.getInstrumentById(selectedId).catch(() => null),
      verificationService.getVerificationRequests().catch(() => ({ requests: [] })),
      certificateService.listCertificates().catch(() => []),
    ])
      .then(([inst, verifRes, certs]) => {
        setInstrument(inst);
        const allVerifs = (verifRes as any)?.requests || verifRes || [];
        const matched = allVerifs.filter((v: any) => v.instrument?.instrumentId === selectedId || v.instrument?._id === inst?._id);
        setVerifications(matched);
        const activeCert = (certs || []).find((c: any) => c.instrumentSnapshot?.instrumentId === selectedId && c.status === 'VALID');
        setCertificate(activeCert || null);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedId]);

  if (isLoading && !instrument) {
    return <LoadingState message="Loading Digital Metrology Passport..." />;
  }

  const qrUrl = certificate?.publicVerificationId ? publicService.getQrImageUrl(certificate.publicVerificationId) : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Metrology Passport"
        subtitle="Immutable statutory digital lifecycle record for legal metrology instruments."
      />

      {/* Instrument Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Scale className="w-5 h-5 text-teal-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-300">Select Instrument:</span>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              navigate(`/passport/${e.target.value}`);
            }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-teal-500 max-w-xs flex-1"
          >
            {instruments.map((inst) => (
              <option key={inst.instrumentId} value={inst.instrumentId}>
                {inst.instrumentId} - {inst.manufacturer} ({inst.category})
              </option>
            ))}
          </select>
        </div>

        {certificate?.publicVerificationId && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition-colors border border-slate-700"
            >
              <QrCode className="w-4 h-4 text-teal-400" /> Digital Passport QR
            </button>
            <a
              href={`/verify/${certificate.publicVerificationId}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-teal-950/60 hover:bg-teal-900/60 text-xs font-bold text-teal-300 flex items-center gap-1.5 transition-colors border border-teal-500/40"
            >
              Public Ledger <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {!instrument ? (
        <EmptyState title="No Instrument Selected" description="Please select an instrument to view its Digital Passport." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Passport Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-teal-400 block mb-1">
                    Statutory Passport ID
                  </span>
                  <h2 className="text-2xl font-black text-slate-100 font-mono tracking-tight">{instrument.instrumentId}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {instrument.manufacturer} • Model: {instrument.model}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      instrument.status === 'ACTIVE'
                        ? 'bg-teal-950 text-teal-300 border border-teal-500/40'
                        : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {instrument.status}
                  </span>
                </div>
              </div>

              {/* Specification Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Category</span>
                  <span className="font-bold text-slate-200">{instrument.category}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Capacity Range</span>
                  <span className="font-mono text-slate-200">{instrument.capacity ? `${instrument.capacity.value} ${instrument.capacity.unit}` : 'Not recorded'}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Serial Number</span>
                  <span className="font-bold text-slate-200 font-mono">{instrument.serialNumber}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Installation City</span>
                  <span className="font-bold text-slate-200">{instrument.location?.city || 'N/A'}</span>
                </div>
              </div>

              {/* Location & Establishment */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-teal-400 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-200">{instrument.manufacturer} {instrument.model}</p>
                    <p className="text-[11px] text-slate-400">{instrument.location?.address || `${instrument.location?.city}, ${instrument.location?.state}`}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Registry Status</span>
                  <span className="font-mono font-bold text-teal-300">{instrument.status}</span>
                </div>
              </div>
            </div>

            {/* Verification Lifecycle History */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <History className="w-4 h-4" /> Verification Audit Ledger ({verifications.length})
              </h3>
              {verifications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No previous verification records logged for this instrument.</p>
              ) : (
                <div className="space-y-3">
                  {verifications.map((v) => (
                    <div key={v._id || v.requestId} className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className={`w-5 h-5 ${v.status === 'PASSED' ? 'text-teal-400' : 'text-amber-400'}`} />
                        <div>
                          <p className="font-bold text-slate-200 font-mono">Request #{v.requestId}</p>
                          <p className="text-[11px] text-slate-400">Inspector: {typeof v.assignedInspector === 'object' ? v.assignedInspector?.name : v.assignedInspector || 'Unassigned'}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          v.status === 'PASSED' ? 'bg-teal-950 text-teal-300 border border-teal-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        }`}>
                          {v.status}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info Card */}
          <div className="space-y-6">
            {/* Active Certificate Badge */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <Award className="w-4 h-4" /> Active Certificate Status
              </h3>
              {certificate ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/40 space-y-2">
                    <span className="text-[10px] text-teal-300/80 font-mono uppercase block">Certificate Number</span>
                    <p className="text-sm font-bold text-teal-200 font-mono">{certificate.certificateNumber}</p>
                    <div className="flex justify-between text-[11px] text-teal-300/90 pt-2 border-t border-teal-800/40">
                      <span>Expires:</span>
                      <span className="font-mono font-bold">{new Date(certificate.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Integrity Status:</span>
                      <span className="text-teal-400 font-bold">LMO Sealed</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Algorithm:</span>
                      <span className="font-mono">{certificate.integrityMetadata?.algorithm || 'HMAC-SHA256'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 space-y-1">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <p className="font-bold">No Active Certificate</p>
                  <p className="text-[11px] text-slate-400">This instrument does not currently hold a valid statutory certificate.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && qrUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">Digital Passport QR</h3>
            <div className="bg-white p-4 rounded-2xl inline-block mx-auto border border-slate-200">
              <img src={qrUrl} alt="Passport QR" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Public scan token for field verification.</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
