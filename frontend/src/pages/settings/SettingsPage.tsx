import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal Profile & System Settings"
        subtitle="Manage user credentials, active role permissions & security configuration."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Settings' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="User Account Information" subtitle="Authenticated identity credentials">
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Full Name:</span>
              <span className="font-semibold text-slate-200">{user?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Email Address:</span>
              <span className="font-semibold text-slate-200">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Assigned Role:</span>
              <Badge variant="info">{user?.role}</Badge>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Organization:</span>
              <span className="font-semibold text-slate-200">{user?.organization || 'Legal Metrology Department'}</span>
            </div>
          </div>
        </Card>

        <Card title="Backend API & Security Settings" subtitle="Live endpoint connection details">
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">API Gateway Base URL:</span>
              <span className="font-mono text-teal-400">http://localhost:5000/api</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">FastAPI AI Service:</span>
              <span className="font-mono text-purple-400">http://localhost:8000</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">HMAC Integrity Hash:</span>
              <span className="font-mono text-emerald-400">SHA-256 Enabled</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Complaint Encryption:</span>
              <span className="font-mono text-sky-400">AES-256-GCM</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
