import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { BrainCircuit, AlertTriangle, Zap } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const RiskIntelligencePage: React.FC = () => {
  const riskFactorData = [
    { factor: 'Inspection History', weight: '30%', impact: 85 },
    { factor: 'Instrument Age', weight: '20%', impact: 65 },
    { factor: 'Regional Correlation', weight: '20%', impact: 50 },
    { factor: 'Tolerance Deviation', weight: '15%', impact: 70 },
    { factor: 'Complaint Volume', weight: '15%', impact: 40 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Risk Intelligence & Anomaly Scoring"
        subtitle="Explainable Isolation Forest risk matrix & automated priority scoring."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Risk Intelligence' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Risk Model"
          value="v2.4 Isolation"
          subtitle="FastAPI AI Engine online"
          icon={<BrainCircuit className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="High Risk Instruments"
          value="14"
          subtitle="Priority inspection queue"
          icon={<AlertTriangle className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Anomalies Flagged"
          value="8"
          subtitle="Unusual wear / tampering"
          icon={<Zap className="w-6 h-6" />}
          color="teal"
        />
      </div>

      <Card title="Risk Scoring Factor Weightings" subtitle="Configurable weights summing to 100%">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskFactorData}>
              <XAxis dataKey="factor" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
              <Bar dataKey="impact" fill="#0d9488" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
