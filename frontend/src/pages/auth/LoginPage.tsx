import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldCheck, Scale, Cpu, MapPin, AlertCircle, Eye, EyeOff } from 'lucide-react';
import heroImg from '../../assets/hero.png';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setError('');
    setIsLoading(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Invalid email or password credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Left visual showcase panel */}
      <div className="lg:w-1/2 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between p-8 lg:p-12 relative overflow-hidden">
        {/* Subtle hero image overlay */}
        <div
          className="absolute inset-0 opacity-15 bg-cover bg-center pointer-events-none mix-blend-luminosity"
          style={{ backgroundImage: `url(${heroImg})` }}
        />

        {/* Ambient glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <Logo className="h-10 mb-8" />
          <div className="max-w-md space-y-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-950/80 text-teal-300 border border-teal-500/30 uppercase tracking-widest">
              Legal Metrology Standard Portal
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
        <div className="relative z-10 grid grid-cols-2 gap-4 my-8 max-w-md">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
            <Scale className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Verified Instruments</h4>
              <p className="text-[11px] text-slate-400">Digital passport & lifecycle</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
            <Cpu className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">AI Decision Support</h4>
              <p className="text-[11px] text-slate-400">Isolation forest detection</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Integrity Certificates</h4>
              <p className="text-[11px] text-slate-400">HMAC-SHA256 crypto seal</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
            <MapPin className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Regional Intelligence</h4>
              <p className="text-[11px] text-slate-400">Geo-spatial heatmap</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 pt-4 border-t border-slate-800">
          Official Statutory Platform • Legal Metrology Act Compliance System
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
              name="email"
              type="email"
              placeholder="e.g. admin@smartmetrix.gov.in"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-white transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Sign In to Command Center
            </Button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-800">
            Establishment Owner?{' '}
            <Link to="/register" className="text-teal-400 hover:underline font-semibold">
              Register Owner Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
