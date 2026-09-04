import React, { useState } from 'react';
import { publicService } from '../../services/public.service';
import type { PublicComplaintPayload, PublicComplaintResult } from '../../services/public.service';
import { CheckCircle2, ShieldAlert, Send, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Link } from 'react-router-dom';

export const PublicComplaintPage: React.FC = () => {
  const [formData, setFormData] = useState<PublicComplaintPayload>({
    instrumentId: '',
    businessName: '',
    city: '',
    state: '',
    category: 'WEIGHING_SCALE',
    description: '',
    contactEmail: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<PublicComplaintResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.city || !formData.state || !formData.description) {
      setError('Please fill in required fields (City, State, Description).');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await publicService.submitPublicComplaint(formData);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <Logo />
        <Link to="/public/complaints/track" className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1">
          Track Existing Complaint <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto w-full my-8">
        {result ? (
          <div className="bg-slate-900 border border-teal-500/40 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-teal-400 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-100">Complaint Logged Successfully</h1>
            <p className="text-sm text-slate-300">{result.message}</p>
            
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Complaint ID:</span>
                <span className="text-xs font-bold text-slate-200">{result.complaintId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Tracking Token:</span>
                <span className="text-xs font-bold text-teal-400">{result.trackingToken}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Save your Tracking Token to check the status of your reported consumer complaint at any time.
            </p>

            <Link
              to={`/public/complaints/track?token=${result.trackingToken}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white transition-colors"
            >
              Track Complaint Status <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-teal-400" /> Report Legal Metrology Non-Compliance
              </h1>
              <p className="text-xs text-slate-400">
                Submit consumer complaints regarding faulty weighing scales, uncalibrated fuel dispensers, or tampered metrology seals directly to the Enforcement Authority.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Business Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="e.g. Metro Fuel Station #12"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Instrument ID / Serial (Optional)</label>
                  <input
                    type="text"
                    value={formData.instrumentId}
                    onChange={(e) => setFormData({ ...formData, instrumentId: e.target.value })}
                    placeholder="e.g. INS-2026-99"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="WEIGHING_SCALE">Weighing Scale</option>
                    <option value="FUEL_DISPENSER">Fuel Dispenser</option>
                    <option value="TAXI_METER">Taxi Meter</option>
                    <option value="STORAGE_TANK">Storage Tank</option>
                    <option value="FLOW_METER">Flow Meter</option>
                    <option value="OTHER">Other Metrology Device</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description of Issue *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe observed discrepancy, weight deviation, broken seal, or short delivery..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contact Email (Optional for updates)</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="consumer@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <Send className="w-4 h-4" /> {isSubmitting ? 'Submitting Report...' : 'Submit Statutory Complaint'}
              </button>
            </form>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-800 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} SmartMetrix Public Enforcement Portal.
      </footer>
    </div>
  );
};
