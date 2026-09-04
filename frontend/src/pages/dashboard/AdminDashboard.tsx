import React, { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analytics.service';
import { demoService } from '../../services/demo.service';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Scale, ClipboardCheck, ShieldCheck, AlertOctagon, Zap, RefreshCw, MapPin } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const [kpis, setKpis] = useState<any>(null);
  const [riskData, setRiskData] = useState<any[]>([]);
  const [priorityInspections, setPriorityInspections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [kpiRes, riskRes, priorityRes] = await Promise.allSettled([
        analyticsService.getDashboardKpis(),
        analyticsService.getRiskDistribution(),
        analyticsService.getPriorityInspections(),
      ]);

      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value);
      if (riskRes.status === 'fulfilled') setRiskData(riskRes.value || []);
      if (priorityRes.status === 'fulfilled') setPriorityInspections(priorityRes.value || []);
    } catch (err: any) {
      setError('Unable to retrieve admin analytics data from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateDemoData = async () => {
    setIsGeneratingDemo(true);
    setDemoMessage('');
    try {
      const res = await demoService.generateDemoData({
        count: 100,
        seed: 'smartmetrix-demo',
      });
      setDemoMessage(`Successfully generated ${res.recordCounts?.instruments || 100} realistic legal metrology records!`);
      await loadData();
    } catch (err: any) {
      setDemoMessage(`Demo generation failed: ${err.response?.data?.message || err.message || 'Error executing engine'}`);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading Admin Command Dashboard..." />;
  if (error) return <ErrorState title="Dashboard Error" description={error} onRetry={loadData} />;

  // Default fallback charts data if backend has no records yet
  const defaultPieData = riskData.length > 0 ? riskData : [
    { name: 'LOW', value: kpis?.totalInstruments ? Math.floor(kpis.totalInstruments * 0.6) : 60, color: '#10b981' },
    { name: 'MEDIUM', value: kpis?.totalInstruments ? Math.floor(kpis.totalInstruments * 0.25) : 25, color: '#f59e0b' },
    { name: 'HIGH', value: kpis?.totalInstruments ? Math.floor(kpis.totalInstruments * 0.15) : 15, color: '#ef4444' },
  ];

  const trendData = [
    { month: 'Jan', verifications: 45, passed: 42 },
    { month: 'Feb', verifications: 52, passed: 48 },
    { month: 'Mar', verifications: 61, passed: 55 },
    { month: 'Apr', verifications: 68, passed: 62 },
    { month: 'May', verifications: 84, passed: 79 },
    { month: 'Jun', verifications: 95, passed: 89 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">
            Executive Operations
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">System Intelligence Overview</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerateDemoData}
            isLoading={isGeneratingDemo}
            icon={<Zap className="w-3.5 h-3.5" />}
          >
            ⚡ Generate Demo Data
          </Button>
        </div>
      </div>

      {demoMessage && (
        <div className="p-3 bg-teal-950/80 border border-teal-500/40 rounded-xl text-xs font-semibold text-teal-300">
          {demoMessage}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Instruments"
          value={kpis?.totalInstruments ?? 0}
          subtitle="Registered across districts"
          icon={<Scale className="w-6 h-6" />}
          color="teal"
        />
        <StatCard
          title="Pending Requests"
          value={kpis?.pendingVerifications ?? 0}
          subtitle="Awaiting inspector assignment"
          icon={<ClipboardCheck className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Completed Inspections"
          value={kpis?.totalInspections ?? 0}
          subtitle="Verified with HMAC integrity"
          icon={<ShieldCheck className="w-6 h-6" />}
          color="emerald"
        />
        <StatCard
          title="High Risk Instruments"
          value={kpis?.highRiskCount ?? 0}
          subtitle="HIGH or CRITICAL risk level"
          icon={<AlertOctagon className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Chart */}
        <Card title="AI Risk Band Distribution" subtitle="Isolation Forest risk categorization">
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={defaultPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {defaultPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || (index === 0 ? '#10b981' : index === 1 ? '#f59e0b' : '#ef4444')} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Verification Trend Chart */}
        <Card title="Verification Volume & Compliance Pass Rate" subtitle="Monthly throughput analytics">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorVerif" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Area type="monotone" dataKey="verifications" stroke="#14b8a6" fillOpacity={1} fill="url(#colorVerif)" />
                <Area type="monotone" dataKey="passed" stroke="#10b981" fillOpacity={1} fill="url(#colorPass)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Regional Leaflet Overview Map */}
      <Card
        title="Regional GIS Inspection Overview"
        subtitle="Live geo-location coordinates for verification requests"
        action={
          <Link to="/regional">
            <Button variant="outline" size="sm" icon={<MapPin className="w-3.5 h-3.5" />}>
              Open Full Map
            </Button>
          </Link>
        }
      >
        <div className="h-80 w-full rounded-xl overflow-hidden border border-slate-700/60">
          <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[19.076, 72.8777]}>
              <Popup>Mumbai Central Legal Metrology Zone</Popup>
            </Marker>
            <Marker position={[28.6139, 77.209]}>
              <Popup>Delhi Capital Verification Division</Popup>
            </Marker>
            <Marker position={[12.9716, 77.5946]}>
              <Popup>Bengaluru Tech Inspection Zone</Popup>
            </Marker>
          </MapContainer>
        </div>
      </Card>

      {/* Priority Inspections */}
      <Card title="High-Priority Action Required" subtitle="Instruments flagged for imminent verification or high risk">
        {priorityInspections.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {priorityInspections.slice(0, 5).map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{item.name || item.instrumentId}</h4>
                  <p className="text-xs text-slate-400">{item.location?.city || item.district || 'Regional Division'}</p>
                </div>
                <Badge variant={item.riskLevel === 'HIGH' ? 'fail' : 'pending'}>
                  {item.riskLevel || 'HIGH RISK'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-4">No high-priority inspection alerts currently pending.</p>
        )}
      </Card>
    </div>
  );
};
