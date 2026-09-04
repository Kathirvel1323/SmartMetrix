import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldCheck, Scale, Cpu, MapPin, KeyRound, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Left visual showcase panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950/40 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div>
          <Logo className="h-10 mb-8" />
          <div className="max-w-md space-y-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-950/80 text-teal-300 border border-teal-500/30 uppercase tracking-widest">
              SIH 2026 Legal Metrology Platform
            </span>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Legal Metrology Command Center
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Real-time verification tracking, AI anomaly detection, tamper-evident digital certificates, and regional compliance analytics for legal measurement instruments.
            </p>
          </div>
        </div>

        {/* Feature highlight grid */}
        <div className="grid grid-cols-2 gap-4 my-8 max-w-md">
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
            <Scale className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Verified Instruments</h4>
              <p className="text-[11px] text-slate-400">Digital passport & lifecycle</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
            <Cpu className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">AI Decision Support</h4>
              <p className="text-[11px] text-slate-400">Isolation forest detection</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Integrity Certificates</h4>
              <p className="text-[11px] text-slate-400">HMAC-SHA256 crypto seal</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
            <MapPin className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Regional Intelligence</h4>
              <p className="text-[11px] text-slate-400">Geo-spatial heatmap</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          Official Prototype • Government of India Legal Metrology Standard Compliant
        </div>
      </div>

      {/* Right login form card */}
      <div className="lg:w-1/2 p-6 sm:p-12 flex flex-col justify-center items-center bg-slate-950">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Portal Authentication</h2>
            <p className="text-xs text-slate-400 mt-1">Sign in with your role-based credentials to access the command center.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. admin@smartmetrix.gov.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Sign In to Command Center
            </Button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
              <KeyRound className="w-3.5 h-3.5 text-teal-400" />
              <span>Quick Demo Accounts</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@smartmetrix.gov.in', 'Admin@123456')}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold transition-colors"
              >
                ⚡ ADMIN
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('inspector1@smartmetrix.gov.in', 'Inspector@123456')}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-teal-500/30 text-teal-300 rounded-lg text-xs font-semibold transition-colors"
              >
                🔍 INSPECTOR
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('owner1@smartmetrix.com', 'Owner@123456')}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-semibold transition-colors"
              >
                🏢 OWNER
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            Establishment Owner?{' '}
            <Link to="/register" className="text-teal-400 hover:underline font-semibold">
              Register New Owner Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
