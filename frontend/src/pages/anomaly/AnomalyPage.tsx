import React, { useState, useEffect } from 'react';
import { anomalyService } from '../../services/anomaly.service';
import type { AnomalyAssessment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ShieldAlert, RefreshCw, Info, Zap, BrainCircuit } from 'lucide-react';

export const AnomalyPage: React.FC = () => {
  const [anomalies, setAnomalies] = useState<AnomalyAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await anomalyService.getPotentialAnomalies();
      setAnomalies(data);
    } catch {
      setError('Failed to load Potential Anomaly data from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) return <LoadingState message="Loading Potential Anomaly Intelligence..." />;
  if (error) return <ErrorState title="Anomaly Data Unavailable" description={error} onRetry={loadData} />;

  const methodLabel = (method: string) => {
    if (method === 'ISOLATION_FOREST') return 'Isolation Forest';
    if (method === 'DETERMINISTIC_STATISTICAL_FALLBACK') return 'Statistical Fallback';
    return 'Insufficient Data';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Potential Anomaly Intelligence"
        subtitle="Instruments flagged by the Isolation Forest AI model as exhibiting unusual wear patterns or measurement behaviour."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Anomaly Intelligence' }]}
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

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-red-500/20 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-2xl font-extrabold text-red-400">{anomalies.length}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Potential Anomalies
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <BrainCircuit className="w-5 h-5 text-purple-400 mb-2" />
          <p className="text-sm font-bold text-purple-300">
            {anomalies.length > 0
              ? methodLabel(anomalies[0].method)
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Active Model Method
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <Zap className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-extrabold text-amber-400">
            {anomalies.length > 0
              ? (anomalies[0].anomalyScore !== null
                  ? `${(anomalies[0].anomalyScore * 100).toFixed(0)}%`
                  : '—')
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Highest Anomaly Score
          </p>
        </div>
      </div>

      {/* Anomaly cards */}
      {anomalies.length === 0 ? (
        <Card>
          <div className="py-14 text-center text-slate-400 space-y-2">
            <ShieldAlert className="w-10 h-10 mx-auto text-teal-600 opacity-40" />
            <p className="text-sm font-medium">No potential anomalies detected.</p>
            <p className="text-xs text-slate-500">
              Run anomaly analysis on individual instruments or use batch analysis to populate this view.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {anomalies.map((item) => (
            <Card key={item._id} className="border-red-500/20">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono text-xs font-bold text-red-400">
                      {item.instrumentIdSnapshot || item.instrument?.instrumentId}
                    </span>
                    <Badge variant="fail">POTENTIAL ANOMALY</Badge>
                    <Badge variant="info">{methodLabel(item.method)}</Badge>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {item.instrument?.name || item.instrumentIdSnapshot}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.instrument?.type || ''}
                    {item.instrument?.location?.city
                      ? ` — ${item.instrument.location.city}`
                      : ''}
                  </p>

                  {/* Contributing factors */}
                  {item.contributingFactors.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.contributingFactors.map((f, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 bg-red-950/40 border border-red-500/30 text-red-300 text-[10px] font-mono rounded-full"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Features breakdown */}
                  {item.features.filter((f) => f.available).length > 0 && (
                    <div className="mt-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs space-y-1.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
                        Feature Analysis
                      </p>
                      {item.features
                        .filter((f) => f.available)
                        .map((feat, fi) => (
                          <div key={fi} className="flex justify-between gap-2">
                            <span className="text-slate-400 truncate">{feat.name}</span>
                            <span className="text-slate-200 font-mono shrink-0">
                              {feat.value !== null ? feat.value.toFixed(3) : '—'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Score panel */}
                <div className="flex flex-col items-center sm:items-end gap-2 shrink-0 sm:min-w-[120px]">
                  <div className="text-center sm:text-right">
                    <p className="text-3xl font-extrabold text-red-400">
                      {item.anomalyScore !== null
                        ? `${(item.anomalyScore * 100).toFixed(0)}%`
                        : '—'}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                      Anomaly Score
                    </p>
                  </div>
                  <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all"
                      style={{ width: `${((item.anomalyScore || 0) * 100)}%` }}
                    />
                  </div>
                  {item.confidence !== null && (
                    <p className="text-[10px] text-slate-500 font-mono">
                      Confidence: {(item.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 font-mono">
                    Data: {(item.dataCoverage * 100).toFixed(0)}% covered
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(item.assessedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Disclaimer from AI model */}
              {item.disclaimer && (
                <p className="mt-3 text-[10px] text-slate-500 italic border-t border-slate-800 pt-2">
                  {item.disclaimer}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Statutory disclaimer */}
      <div className="p-4 bg-slate-900/60 border border-amber-500/20 rounded-xl flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-amber-400">AI Decision Support Only:</span>{' '}
          "Potential Anomaly" flags are generated by the Isolation Forest AI model and represent
          statistical outliers. They do not constitute confirmed fraud, defect, or tampering.
          No enforcement action should be taken solely on the basis of these AI outputs.
          Final statutory PASS/FAIL authority remains exclusively with the authorized Inspector/Legal Metrology Officer.
        </p>
      </div>
    </div>
  );
};
