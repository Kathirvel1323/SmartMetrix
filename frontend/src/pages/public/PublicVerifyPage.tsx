import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicService } from '../../services/public.service';
import type { PublicVerificationData } from '../../services/public.service';
import { ShieldCheck, ShieldAlert, Calendar, Scale, QrCode, ExternalLink } from 'lucide-react';
import { LoadingState } from '../../components/ui/LoadingState';
import { Logo } from '../../components/ui/Logo';

export const PublicVerifyPage: React.FC = () => {
  const { publicVerificationId } = useParams<{ publicVerificationId: string }>();
  const [data, setData] = useState<PublicVerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (!publicVerificationId) {
      setError('No verification token provided');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    publicService
      .verifyPublicCertificate(publicVerificationId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Certificate verification failed');
      })
      .finally(() => setIsLoading(false));
  }, [publicVerificationId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <LoadingState message="Verifying Digital Metrology Certificate with SmartMetrix Ledger..." />
      </div>
    );
  }

  const qrUrl = publicVerificationId ? publicService.getQrImageUrl(publicVerificationId) : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <Logo />
        <Link
          to="/login"
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
        >
          Authorized Portal Login <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto w-full my-8">
        {error ? (
          <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-8 text-center space-y-4">
            <ShieldAlert className="w-16 h-16 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-red-200">Certificate Verification Failed</h1>
            <p className="text-sm text-red-300/80 max-w-md mx-auto">{error}</p>
            <p className="text-xs text-slate-400">
              The requested certificate token may be invalid, revoked, or non-existent in the public ledger.
            </p>
          </div>
        ) : data ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Status Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-3">
                {data.integrityStatus === 'VALID' && data.status === 'VALID' ? (
                  <ShieldCheck className="w-10 h-10 text-teal-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-10 h-10 text-amber-400 shrink-0" />
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    Statutory Certificate Verification
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">ID: {data.publicVerificationId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    data.status === 'VALID'
                      ? 'bg-teal-950 text-teal-300 border border-teal-500/40'
                      : 'bg-red-950 text-red-300 border border-red-500/40'
                  }`}
                >
                  {data.status}
                </span>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <QrCode className="w-4 h-4 text-teal-400" /> View QR
                </button>
              </div>
            </div>

            {/* Instrument Metadata */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <Scale className="w-4 h-4" /> Instrument Metadata (Privacy Preserved)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Instrument Category</span>
                  <span className="text-sm font-semibold text-slate-200">{data.instrument?.category || 'Legal Metrology'}</span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Manufacturer & Model</span>
                  <span className="text-sm font-semibold text-slate-200">
                    {data.instrument?.manufacturer} - {data.instrument?.model}
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Masked Serial Number</span>
                  <span className="text-sm font-mono text-slate-200">{data.instrument?.maskedSerialNumber || '••••••••'}</span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Issuing Authority</span>
                  <span className="text-sm font-semibold text-slate-200">{data.issuingAuthorityLabel || 'Legal Metrology Department'}</span>
                </div>
              </div>
            </div>

            {/* Validity Timeline */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Validity & Integrity Ledger
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Verification Date</span>
                  <span className="text-xs font-mono text-slate-300">
                    {data.verificationDate ? new Date(data.verificationDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Valid From</span>
                  <span className="text-xs font-mono text-slate-300">
                    {data.validFrom ? new Date(data.validFrom).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Expires At</span>
                  <span className="text-xs font-mono text-teal-300 font-bold">
                    {data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Statutory Disclaimer */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Statutory Notice</p>
              <p>{data.disclaimer || 'This public verification record confirms statutory compliance at the time of inspection under the Legal Metrology Act.'}</p>
            </div>
          </div>
        ) : null}
      </main>

      {/* QR Code Modal */}
      {showQrModal && qrUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">Verification QR Code</h3>
            <div className="bg-white p-4 rounded-2xl inline-block mx-auto border border-slate-200 shadow-inner">
              <img src={qrUrl} alt="Public Verification QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">Scan with any smartphone camera to verify statutory certificate authenticity.</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-800 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} SmartMetrix Statutory Verification Engine. Privacy Safe Public Portal.
      </footer>
    </div>
  );
};
