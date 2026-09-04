import React, { useState, useEffect } from 'react';
import { phase7Service } from '../../services/phase7.service';
import type { PhotoAssistAssessment, PredictiveAssessment, PlanningTwinRepresentation, BurdenOptimizeResponse, GeoScheduleResponse, VerificationMethodRule } from '../../services/phase7.service';
import { instrumentService } from '../../services/instrument.service';
import type { Instrument } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { Brain, Camera, TrendingUp, Cpu, MapPin, Sliders, Upload, Plus } from 'lucide-react';

export const DecisionSupportPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'photo' | 'predictive' | 'planning' | 'geo' | 'rules'>('photo');

  // Shared state
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Tab 1: Photo Assist state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoAssistAssessment | null>(null);

  // Tab 2: Predictive state
  const [predictiveResult, setPredictiveResult] = useState<PredictiveAssessment | null>(null);

  // Tab 3: Planning Twin & Burden state
  const [twinResult, setTwinResult] = useState<PlanningTwinRepresentation | null>(null);
  const [burdenResult, setBurdenResult] = useState<BurdenOptimizeResponse | null>(null);

  // Tab 4: Geo Schedule state
  const [geoResult, setGeoResult] = useState<GeoScheduleResponse | null>(null);

  // Tab 5: Rules state
  const [rules, setRules] = useState<VerificationMethodRule[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    instrumentType: 'WEIGHING_SCALE',
    instrumentCategory: 'COMMERCIAL',
    verificationMethod: 'GRAVIMETRIC_STANDARD',
    requiredEquipment: ['Standard Test Weights'],
    estimatedEffortHours: 2
  });

  useEffect(() => {
    instrumentService.getInstruments().then((res: any) => {
      const list = res.instruments || res || [];
      setInstruments(list);
      if (list.length > 0) setSelectedInstrumentId(list[0].instrumentId);
    }).catch(() => {});
  }, []);

  // Fetch rules if rules tab selected
  useEffect(() => {
    if (activeTab === 'rules') {
      phase7Service.listVerificationRules().then((res) => setRules(res || [])).catch(() => {});
    }
  }, [activeTab]);

  // Tab 1 Handler: Photo Assist Analysis
  const handlePhotoAssist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile || !selectedInstrumentId) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      formData.append('instrumentId', selectedInstrumentId);
      const res = await phase7Service.analyzePhoto(formData);
      setPhotoResult(res);
    } catch (err: any) {
      alert(err.message || 'Photo assist analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Tab 2 Handler: Predictive Analysis
  const handlePredictive = async () => {
    if (!selectedInstrumentId) return;
    setIsLoading(true);
    try {
      const res = await phase7Service.analyzePredictive(selectedInstrumentId);
      setPredictiveResult(res);
    } catch (err: any) {
      alert(err.message || 'Predictive analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Tab 3 Handlers: Planning Twin & Burden Optimization
  const handleRunPlanningTwin = async () => {
    if (!selectedInstrumentId) return;
    setIsLoading(true);
    try {
      const res = await phase7Service.getPlanningTwin(selectedInstrumentId);
      setTwinResult(res);
    } catch (err: any) {
      alert(err.message || 'Planning twin fetch failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimizeBurden = async () => {
    if (!selectedInstrumentId) return;
    setIsLoading(true);
    try {
      const res = await phase7Service.optimizeBurden(selectedInstrumentId);
      setBurdenResult(res);
    } catch (err: any) {
      alert(err.message || 'Burden optimization failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Tab 4 Handler: Geo Schedule Recommendation
  const handleGeoSchedule = async () => {
    if (!selectedInstrumentId) return;
    setIsLoading(true);
    try {
      const res = await phase7Service.recommendGeoSchedule(selectedInstrumentId);
      setGeoResult(res);
    } catch (err: any) {
      alert(err.message || 'Geo scheduling failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Tab 5 Handler: Create Verification Method Rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await phase7Service.createVerificationRule(newRule);
      setShowRuleModal(false);
      const updated = await phase7Service.listVerificationRules();
      setRules(updated || []);
    } catch (err: any) {
      alert(err.message || 'Failed to create verification method rule');
    }
  };

  const handleDeactivateRule = async (ruleId: string) => {
    try {
      await phase7Service.deactivateVerificationRule(ruleId);
      const updated = await phase7Service.listVerificationRules();
      setRules(updated || []);
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate rule');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Decision Support Hub"
        subtitle="Data-driven planning and verification assistance tools. Inspector/LMO remains sole statutory authority."
      />

      {/* Advice Notice Banner */}
      <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/40 flex items-center gap-3 text-xs text-teal-300">
        <Brain className="w-5 h-5 text-teal-400 shrink-0" />
        <p>
          <span className="font-bold">Statutory Notice:</span> Decision support calculations do not alter official verification certificates, statutory intervals, or legal Pass/Fail results. Final statutory authority rests exclusively with authorized Inspectors/LMOs.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('photo')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'photo' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" /> Photo Assist (Quality Metrics)
        </button>
        <button
          onClick={() => setActiveTab('predictive')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'predictive' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Predictive Deviation Trends
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'planning' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" /> Planning Twin & Burden Optimization
        </button>
        <button
          onClick={() => setActiveTab('geo')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'geo' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" /> Geo-Scheduling Recommendation
        </button>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'rules' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" /> Verification Method Rules
          </button>
        )}
      </div>

      {/* TAB 1: Photo Assist */}
      {activeTab === 'photo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-400" /> Photo Assist Assessment
            </h3>
            <form onSubmit={handlePhotoAssist} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Instrument</label>
                <select
                  value={selectedInstrumentId}
                  onChange={(e) => setSelectedInstrumentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  {instruments.map((inst) => (
                    <option key={inst.instrumentId} value={inst.instrumentId}>
                      {inst.instrumentId} - {inst.manufacturer} ({inst.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Inspection Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-300 file:bg-slate-800 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:font-semibold file:text-teal-400 hover:file:bg-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !photoFile}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> {isLoading ? 'Evaluating Image Quality...' : 'Run Image Quality Analysis'}
              </button>
            </form>
          </div>

          {/* Photo Result Display */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-100">Computed Quality Metrics & Semantic Status</h3>
            {photoResult ? (
              <div className="space-y-4 text-xs">
                {/* Quality Metrics */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-teal-400 block mb-1">Computed Image Quality Metrics</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Resolution:</span>{' '}
                      <span className="font-mono text-slate-200">{photoResult.qualityMetrics?.resolutionWidth}x{photoResult.qualityMetrics?.resolutionHeight}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Blur Score:</span>{' '}
                      <span className="font-mono text-slate-200">{photoResult.qualityMetrics?.blurScore}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Brightness:</span>{' '}
                      <span className="font-mono text-slate-200">{photoResult.qualityMetrics?.brightnessScore}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Contrast:</span>{' '}
                      <span className="font-mono text-slate-200">{photoResult.qualityMetrics?.contrastScore}</span>
                    </div>
                  </div>
                </div>

                {/* Semantic Checks */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-teal-400 block mb-1">Semantic Field Status</span>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Serial Number Extraction:</span>
                      <span className="font-mono text-slate-300 font-bold">{photoResult.semanticFields?.serialNumberText || 'NOT_ASSESSED'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Seal Verification:</span>
                      <span className="font-mono text-slate-300 font-bold">{photoResult.semanticFields?.sealText || 'NOT_ASSESSED'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Readout Match:</span>
                      <span className="font-mono text-slate-300 font-bold">{photoResult.semanticFields?.readoutText || 'NOT_ASSESSED'}</span>
                    </div>
                  </div>
                </div>

                {photoResult.irregularities && photoResult.irregularities.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-[11px]">
                    <span className="font-bold block mb-0.5">Flagged Observations:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {photoResult.irregularities.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 italic p-3 rounded-xl bg-slate-950 border border-slate-800">
                  {photoResult.disclaimer}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Select an inspection image to calculate objective image quality metrics.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Predictive Analytics */}
      {activeTab === 'predictive' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl max-w-3xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-400" /> Historical Deviation Trend Analysis
          </h3>
          <div className="flex gap-3 text-xs">
            <select
              value={selectedInstrumentId}
              onChange={(e) => setSelectedInstrumentId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {instruments.map((inst) => (
                <option key={inst.instrumentId} value={inst.instrumentId}>
                  {inst.instrumentId} - {inst.manufacturer} ({inst.category})
                </option>
              ))}
            </select>
            <button
              onClick={handlePredictive}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
            >
              {isLoading ? 'Calculating...' : 'Analyze Trend'}
            </button>
          </div>

          {predictiveResult && (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Trend Direction</span>
                  <span
                    className={`font-mono font-bold text-sm uppercase ${
                      predictiveResult.trendDirection === 'WORSENING'
                        ? 'text-amber-400'
                        : predictiveResult.trendDirection === 'IMPROVING'
                        ? 'text-teal-400'
                        : 'text-slate-200'
                    }`}
                  >
                    {predictiveResult.trendDirection}
                  </span>
                </div>
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Regression Slope</span>
                  <span className="font-mono font-bold text-slate-200 text-sm">
                    {predictiveResult.slope !== null ? `${predictiveResult.slope >= 0 ? '+' : ''}${predictiveResult.slope}%` : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Sample History Count</span>
                  <span className="font-mono font-bold text-slate-200 text-sm">{predictiveResult.sampleCount} finalized audits</span>
                </div>
              </div>

              {predictiveResult.evidence && predictiveResult.evidence.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-teal-400 block">Analytical Evidence</span>
                  <ul className="list-disc pl-4 text-slate-300 space-y-1">
                    {predictiveResult.evidence.map((ev, idx) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {predictiveResult.attentionRecommendation && (
                <div className="p-4 rounded-xl bg-teal-950/40 border border-teal-800/40 text-teal-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-teal-400 block">Attention Recommendation</span>
                  <p>{predictiveResult.attentionRecommendation}</p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 italic p-3 rounded-xl bg-slate-900 border border-slate-800">
                {predictiveResult.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Planning Twin & Burden Optimization */}
      {activeTab === 'planning' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal-400" /> Planning Twin Representation
            </h3>
            <p className="text-xs text-slate-400">
              Lightweight data-driven planning summary for inspection scheduling. Does not alter statutory certificates.
            </p>
            <div className="flex gap-3 text-xs">
              <select
                value={selectedInstrumentId}
                onChange={(e) => setSelectedInstrumentId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
              >
                {instruments.map((inst) => (
                  <option key={inst.instrumentId} value={inst.instrumentId}>
                    {inst.instrumentId} - {inst.manufacturer} ({inst.category})
                  </option>
                ))}
              </select>
              <button
                onClick={handleRunPlanningTwin}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
              >
                Fetch Twin
              </button>
            </div>

            {twinResult && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Type / Category</span>
                    <span className="font-semibold">{twinResult.type} ({twinResult.category})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Finalized Inspections</span>
                    <span className="font-mono font-bold text-teal-400">{twinResult.inspectionHistorySummary?.totalFinalized}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-800">{twinResult.disclaimer}</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-teal-400" /> Facility Burden Optimization
            </h3>
            <p className="text-xs text-slate-400">
              Evaluate closest authorized testing facility profiles and equipment capability rankings.
            </p>
            <button
              onClick={handleOptimizeBurden}
              disabled={isLoading || !selectedInstrumentId}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
            >
              Evaluate Facility Burden Plans
            </button>

            {burdenResult && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                {burdenResult.recommendedPlans && burdenResult.recommendedPlans.length > 0 ? (
                  <div className="space-y-3">
                    {burdenResult.recommendedPlans.map((plan) => (
                      <div key={plan.planId} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-teal-400">Rank #{plan.rank}: {plan.facilityName}</span>
                          <span className="text-slate-300">{plan.facilityLocation?.distanceKm} km</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Method: {plan.verificationMethod} (Score: {plan.burdenScore})</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-300">{burdenResult.message || 'No authorized facility plans configured for this instrument category.'}</p>
                )}
                <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-800">{burdenResult.disclaimer}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Geo-Scheduling */}
      {activeTab === 'geo' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl max-w-3xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-400" /> Inspector Geo-Route Recommendation
          </h3>
          <p className="text-xs text-slate-400">
            Recommends closest available inspector by distance and active schedule count. Does not auto-assign.
          </p>
          <div className="flex gap-3 text-xs">
            <select
              value={selectedInstrumentId}
              onChange={(e) => setSelectedInstrumentId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {instruments.map((inst) => (
                <option key={inst.instrumentId} value={inst.instrumentId}>
                  {inst.instrumentId} - {inst.manufacturer} ({inst.category})
                </option>
              ))}
            </select>
            <button
              onClick={handleGeoSchedule}
              disabled={isLoading || !selectedInstrumentId}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
            >
              Generate Recommendation
            </button>
          </div>

          {geoResult && (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <h4 className="font-bold text-slate-200">Recommended Inspector Assignment Rank</h4>
                {geoResult.recommendations?.map((item) => (
                  <div key={item.inspectorId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-teal-400">Rank #{item.rank}: {item.name}</span>
                      <span className="text-[11px] text-slate-400 block">{item.reason}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">Score: {item.score}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 italic p-3 rounded-xl bg-slate-950 border border-slate-800">
                {geoResult.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Verification Method Rules (ADMIN) */}
      {activeTab === 'rules' && user?.role === 'ADMIN' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Verification Method Rules Engine</h3>
              <p className="text-xs text-slate-400">Configures method requirements, authorized equipment & effort profiles for Phase 7 planning.</p>
            </div>
            <button
              onClick={() => setShowRuleModal(true)}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white flex items-center gap-2 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Method Rule
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-4">Rule Name</th>
                  <th className="p-4">Instrument Type</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Effort</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {rules.map((rule) => (
                  <tr key={rule._id || rule.ruleId}>
                    <td className="p-4 font-bold text-slate-100">{rule.name}</td>
                    <td className="p-4">{rule.instrumentType}</td>
                    <td className="p-4">{rule.instrumentCategory}</td>
                    <td className="p-4 font-mono text-teal-400">{rule.verificationMethod}</td>
                    <td className="p-4 font-mono">{rule.estimatedEffortHours} hrs</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rule.isActive ? 'bg-teal-950 text-teal-300' : 'bg-red-950 text-red-300'}`}>
                        {rule.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {rule.isActive && (
                        <button
                          onClick={() => handleDeactivateRule(rule.ruleId || rule._id)}
                          className="px-3 py-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 text-xs font-bold"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">Create Verification Method Rule</h3>
            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Gravimetric Scale Rule"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Instrument Type</label>
                <input
                  type="text"
                  required
                  value={newRule.instrumentType}
                  onChange={(e) => setNewRule({ ...newRule, instrumentType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={newRule.instrumentCategory}
                  onChange={(e) => setNewRule({ ...newRule, instrumentCategory: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Verification Method</label>
                <input
                  type="text"
                  required
                  value={newRule.verificationMethod}
                  onChange={(e) => setNewRule({ ...newRule, verificationMethod: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Estimated Effort (Hours)</label>
                <input
                  type="number"
                  required
                  value={newRule.estimatedEffortHours}
                  onChange={(e) => setNewRule({ ...newRule, estimatedEffortHours: parseInt(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-white">
                  Save Method Rule
                </button>
                <button type="button" onClick={() => setShowRuleModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300">
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
