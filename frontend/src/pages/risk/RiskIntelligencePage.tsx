import React, { useState, useEffect } from 'react';
import { riskService } from '../../services/risk.service';
import type { RiskPriority, RiskConfiguration } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { BrainCircuit, AlertTriangle, ShieldCheck, RefreshCw, TrendingUp, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#7c3aed',
};

const riskBadgeVariant = (
  level: string
): 'pass' | 'fail' | 'pending' | 'info' => {
  if (level === 'LOW') return 'pass';
  if (level === 'MEDIUM') return 'pending';
  if (level === 'HIGH' || level === 'CRITICAL') return 'fail';
  return 'info';
};

export const RiskIntelligencePage: React.FC = () => {
  const [priorities, setPriorities] = useState<RiskPriority[]>([]);
  const [activeConfig, setActiveConfig] = useState<RiskConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [priorityRes, configRes] = await Promise.allSettled([
        riskService.getPriorityList(),
        riskService.getActiveConfiguration(),
      ]);
      if (priorityRes.status === 'fulfilled') setPriorities(priorityRes.value);
      if (configRes.status === 'fulfilled') setActiveConfig(configRes.value);
    } catch {
      setError('Failed to load Risk Intelligence data from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) return <LoadingState message="Loading AI Risk Intelligence..." />;
  if (error) return <ErrorState title="Risk Data Unavailable" description={error} onRetry={loadData} />;

  // Derive summary stats
  const highCount = priorities.filter(
    (p) => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL'
  ).length;
  const medCount = priorities.filter((p) => p.riskLevel === 'MEDIUM').length;

  // Build factor-weight chart data from the active config
  const factorChartData = activeConfig
    ? Object.entries(activeConfig.weights).map(([key, weight]) => ({
        factor: key.replace(/_/g, ' '),
        weight: Math.round(weight * 100),
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Risk Intelligence & Anomaly Scoring"
        subtitle="Explainable Isolation Forest risk matrix with configurable factor weightings and trust scoring."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Risk Intelligence' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        }
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Risk Model"
          value={
            activeConfig
              ? `v${activeConfig.version} – ${activeConfig.name}`
              : 'Not Configured'
          }
          subtitle={
            activeConfig
              ? `Strategy: ${activeConfig.missingDataStrategy}`
              : 'No active configuration found'
          }
          icon={<BrainCircuit className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="High / Critical Risk"
          value={highCount}
          subtitle="Instruments requiring priority inspection"
          icon={<AlertTriangle className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Medium Risk Flagged"
          value={medCount}
          subtitle="Instruments under monitoring review"
          icon={<TrendingUp className="w-6 h-6" />}
          color="teal"
        />
      </div>

      {/* Factor Weightings */}
      {factorChartData.length > 0 && (
        <Card
          title="Risk Scoring Factor Weightings"
          subtitle={`Active configuration: "${activeConfig?.name}" — weights configured by system administrator`}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={factorChartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="factor"
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                  unit="%"
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Weight']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="weight" radius={[6, 6, 0, 0]}>
                  {factorChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill="#0d9488" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Priority List */}
      <Card
        title="Instrument Risk Priority Queue"
        subtitle="Instruments ranked by latest AI risk assessment score — decision support only. Final PASS/FAIL authority remains with the authorized Inspector/LMO."
      >
        {priorities.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto text-teal-600 opacity-40" />
            <p className="text-sm font-medium">No risk assessments found.</p>
            <p className="text-xs text-slate-500">
              Run risk assessments from individual instrument records or use batch analysis.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {priorities.map((item) => (
              <div
                key={item._id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-teal-400">
                      {item.instrumentIdSnapshot || item.instrument?.instrumentId}
                    </span>
                    <Badge variant={riskBadgeVariant(item.riskLevel)}>
                      {item.riskLevel}
                    </Badge>
                    <Badge variant={item.trustLevel === 'HIGH' ? 'pass' : item.trustLevel === 'LOW' ? 'fail' : 'pending'}>
                      Trust: {item.trustLevel}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {item.instrument?.name || item.instrumentIdSnapshot}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {item.instrument?.location?.city
                      ? `${item.instrument.location.city}, ${item.instrument.location.district || ''}`
                      : item.instrument?.type || 'Unknown location'}
                  </p>
                  <p className="text-[11px] text-amber-400 mt-1 font-medium">
                    {item.recommendedAction}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Risk score bar */}
                  <div className="text-right">
                    <span className="text-2xl font-extrabold" style={{ color: RISK_COLORS[item.riskLevel] || '#64748b' }}>
                      {item.riskScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">/ 100</span>
                  </div>
                  <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.riskScore}%`,
                        backgroundColor: RISK_COLORS[item.riskLevel] || '#64748b',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Trust: {item.trustScore.toFixed(0)}/100
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Statutory Disclaimer */}
        <div className="mt-4 p-3 bg-slate-900/60 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400">
            <span className="font-semibold text-amber-400">AI Decision Support Only:</span>{' '}
            Risk scores are generated by the Isolation Forest model and are labelled as "Potential Anomaly" or "Risk Pattern".
            They do not constitute confirmed fraud or a final enforcement decision. Final statutory PASS/FAIL authority remains exclusively
            with the authorized Inspector/Legal Metrology Officer.
          </p>
        </div>
      </Card>
    </div>
  );
};
