import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AlertCircle, Building2, Eye, EyeOff, ShieldCheck, FileCheck2 } from 'lucide-react';
import heroImg from '../../assets/hero.png';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    organization: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register account. Please check inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Left visual showcase panel */}
      <div className="lg:w-1/2 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between p-8 lg:p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-15 bg-cover bg-center pointer-events-none mix-blend-luminosity"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <Logo className="h-10 mb-8" />
          <div className="max-w-md space-y-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-sky-950/80 text-sky-300 border border-sky-500/30 uppercase tracking-widest">
              Establishment Owner Portal
            </span>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Register Establishment Instruments
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Create an official owner account to submit verification requests, track statutory inspections, download tamper-evident digital certificates, and manage asset compliance.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 my-8 max-w-md">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
            <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Statutory Requests</h4>
              <p className="text-[11px] text-slate-400">Request formal re-verification</p>
            </div>
          </div>
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
            <FileCheck2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Digital Passport</h4>
              <p className="text-[11px] text-slate-400">QR-verifiable certificate records</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 pt-4 border-t border-slate-800">
          Official Statutory Platform • Legal Metrology Act Compliance System
        </div>
      </div>

      {/* Right form container */}
      <div className="lg:w-1/2 p-6 sm:p-12 flex flex-col justify-center items-center bg-slate-950">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Establishment Registration</h2>
            <p className="text-xs text-slate-400 mt-1">
              Register as an Instrument Owner to manage weights, measures and verifications.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name / Representative"
              placeholder="e.g. Ramesh Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. ramesh@traders.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input
              label="Organization / Business Name"
              placeholder="e.g. Apex Commodities Pvt Ltd"
              icon={<Building2 className="w-4 h-4" />}
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            />
            <Input
              label="Phone Number"
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
              Create Owner Account
            </Button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
            Already registered?{' '}
            <Link to="/login" className="text-teal-400 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
