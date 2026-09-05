import React, { useState, useEffect, useCallback } from 'react';
import { certificateService } from '../../services/certificate.service';
import type { CertificatePolicy } from '../../services/certificate.service';
import type { Certificate } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, RefreshCw, ExternalLink, Lock, Plus, Ban, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';

type CertificateBadgeVariant = 'pass' | 'fail' | 'pending' | 'info';

const statusVariant = (status: string): CertificateBadgeVariant => {
  if (status === 'VALID') return 'pass';
  if (status === 'REVOKED') return 'fail';
  if (status === 'EXPIRED') return 'pending';
  return 'info'; // SUPERSEDED
};

const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';

export const CertificatesPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role;
  const [activeTab, setActiveTab] = useState<'certs' | 'policies'>('certs');

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [policies, setPolicies] = useState<CertificatePolicy[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Revoke modal state
  const [revokeCertNumber, setRevokeCertNumber] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // New policy modal state
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: '',
    instrumentType: 'WEIGHING_SCALE',
    instrumentCategory: 'NON_AUTOMATIC_WEIGHING',
    validityPeriodMonths: 12,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const certs = await certificateService.listCertificates();
      setCertificates(certs);
      if (userRole === 'ADMIN' || userRole === 'INSPECTOR') {
        const pols = await certificateService.listPolicies();
        setPolicies(pols);
      }
    } catch {
      setError('Failed to load certificates from the server.');
    } finally {
      setIsLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeCertNumber || !revokeReason.trim()) return;
    setIsRevoking(true);
    try {
      await certificateService.revokeCertificate(revokeCertNumber, revokeReason.trim());
      setRevokeCertNumber(null);
      setRevokeReason('');
      void loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke certificate');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await certificateService.createPolicy(newPolicy);
      setShowPolicyModal(false);
      void loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create policy');
    }
  };

  if (isLoading) return <LoadingState message="Loading Tamper-Evident Certificates..." />;
  if (error) return <ErrorState title="Certificates Unavailable" description={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-Evident Digital Certificates"
        subtitle="HMAC-SHA256 cryptographically sealed verification certificates with public QR validation."
        action={
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        }
      />

      {/* Tabs */}
      {(user?.role === 'ADMIN' || user?.role === 'INSPECTOR') && (
        <div className="flex border-b border-slate-800 space-x-2">
          <button
            onClick={() => setActiveTab('certs')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'certs' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Issued Certificates ({certificates.length})
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'policies' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Issuance Policies ({policies.length})
          </button>
        </div>
      )}

      {activeTab === 'certs' && (
        <>
          {certificates.length === 0 ? (
            <Card>
              <div className="py-14 text-center text-slate-400 space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-teal-600 opacity-40" />
                <p className="text-sm font-medium">No digital certificates issued yet.</p>
                <p className="text-xs text-slate-500">
                  Certificates are issued automatically upon a successful PASS inspection result.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.map((cert) => (
                <Card key={cert._id} className="relative overflow-hidden border-teal-500/20">
                  {/* Integrity seal indicator */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest flex items-center gap-1">
                        <Lock className="w-3 h-3" /> HMAC Integrity Sealed
                      </span>
                      <h3 className="text-lg font-extrabold text-white mt-0.5 font-mono">
                        {cert.certificateNumber}
                      </h3>
                      <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">
                        {cert.instrumentSnapshot?.type} — {cert.instrumentSnapshot?.manufacturer}{' '}
                        {cert.instrumentSnapshot?.model}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={statusVariant(cert.status)}>{cert.status}</Badge>
                      {user?.role === 'ADMIN' && cert.status === 'VALID' && (
                        <button
                          onClick={() => setRevokeCertNumber(cert.certificateNumber)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5"
                        >
                          <Ban className="w-3 h-3" /> Revoke
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Snapshot details */}
                  <div className="my-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Instrument ID</span>
                      <span className="font-mono text-teal-400">{cert.instrumentSnapshot?.instrumentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Category</span>
                      <span className="text-slate-200 font-medium">{cert.instrumentSnapshot?.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Validity Period</span>
                      <span className="font-mono text-slate-200">
                        {formatDate(cert.validFrom)} → {formatDate(cert.expiresAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Statutory Ledger Verified
                    </span>
                    <Link
                      to={`/verify/${cert.publicVerificationId}`}
                      target="_blank"
                      className="px-3 py-1 rounded-lg bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 font-bold text-xs flex items-center gap-1 border border-teal-500/40"
                    >
                      Public Verify <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Policies Tab */}
      {activeTab === 'policies' && (user?.role === 'ADMIN' || user?.role === 'INSPECTOR') && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-100">Statutory Certificate Issuance Policies</h3>
            {user?.role === 'ADMIN' && (
              <Button size="sm" onClick={() => setShowPolicyModal(true)} icon={<Plus className="w-4 h-4" />}>
                Create Policy
              </Button>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-4">Policy ID</th>
                  <th className="p-4">Name / Scope</th>
                  <th className="p-4">Validity (Months)</th>
                  <th className="p-4">Version</th>
                  <th className="p-4">Status</th>
                  {user?.role === 'ADMIN' && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {policies.map((p) => (
                  <tr key={p._id || p.policyId}>
                    <td className="p-4 font-mono font-bold text-teal-400">{p.policyId}</td>
                    <td className="p-4">
                      <span className="block font-semibold text-slate-200">{p.name}</span>
                      <span className="block text-[10px] text-slate-500">{p.instrumentType} / {p.instrumentCategory}</span>
                    </td>
                    <td className="p-4 font-mono">{p.validityPeriodMonths} months</td>
                    <td className="p-4 font-mono">v{p.version}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.isActive ? 'bg-teal-950 text-teal-300' : 'bg-red-950 text-red-300'}`}>
                        {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="p-4 text-right">
                        {p.isActive ? (
                          <button
                            onClick={async () => {
                              await certificateService.deactivatePolicy(p.policyId);
                              loadData();
                            }}
                            className="px-2.5 py-1 rounded bg-red-950/60 text-red-300 font-bold hover:bg-red-900"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await certificateService.activatePolicy(p.policyId);
                              loadData();
                            }}
                            className="px-2.5 py-1 rounded bg-teal-950/60 text-teal-300 font-bold hover:bg-teal-900"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revoke Certificate Modal */}
      {revokeCertNumber && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-red-400">Revoke Certificate #{revokeCertNumber}</h3>
            <form onSubmit={handleRevoke} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Reason for Revocation *</label>
                <textarea
                  required
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Instrument failed unannounced spot audit, seal tampered..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isRevoking}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold text-white transition-colors"
                >
                  {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
                </button>
                <button
                  type="button"
                  onClick={() => setRevokeCertNumber(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">Create Certificate Policy</h3>
            <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Policy Name</label>
                <input
                  type="text"
                  required
                  value={newPolicy.name}
                  onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                  placeholder="e.g. Standard weighing scale policy"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Instrument Type</label>
                <input
                  type="text"
                  required
                  value={newPolicy.instrumentType}
                  onChange={(e) => setNewPolicy({ ...newPolicy, instrumentType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Instrument Category</label>
                <input
                  type="text"
                  required
                  value={newPolicy.instrumentCategory}
                  onChange={(e) => setNewPolicy({ ...newPolicy, instrumentCategory: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Validity (Months)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={newPolicy.validityPeriodMonths}
                  onChange={(e) => setNewPolicy({ ...newPolicy, validityPeriodMonths: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-white">
                  Save Policy
                </button>
                <button type="button" onClick={() => setShowPolicyModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
