import React, { useState, useEffect } from 'react';
import { regionalService } from '../../services/regional.service';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { RefreshCw, Map, Users, Info } from 'lucide-react';
import '../../utils/leaflet-icons';

type BadgeVariant = 'pass' | 'fail' | 'pending' | 'info';

const patternVariant = (pt: string): BadgeVariant => {
  if (pt === 'Potential Cluster') return 'fail';
  if (pt === 'Risk Pattern') return 'pending';
  if (pt === 'Correlation') return 'info';
  return 'info';
};

export const RegionalIntelligencePage: React.FC = () => {
  const [mapData, setMapData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [activeConfig, setActiveConfig] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [mapRes, clusterRes, configRes] = await Promise.allSettled([
        regionalService.getMapData(),
        regionalService.getClusters(),
        regionalService.getActiveConfig(),
      ]);
      if (mapRes.status === 'fulfilled') setMapData(mapRes.value);
      if (clusterRes.status === 'fulfilled') setClusters(clusterRes.value);
      if (configRes.status === 'fulfilled') setActiveConfig(configRes.value);
    } catch {
      setError('Failed to load Regional Intelligence data from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) return <LoadingState message="Loading Regional Geo-Spatial Intelligence..." />;
  if (error) return <ErrorState title="Regional Data Unavailable" description={error} onRetry={loadData} />;

  // Extract markers from GeoJSON FeatureCollection
  const markers: Array<{
    lat: number;
    lon: number;
    name: string;
    instrumentId: string;
    type: string;
    status: string;
  }> = [];

  if (mapData?.features) {
    for (const feature of mapData.features) {
      if (
        feature.geometry.type === 'Point' &&
        feature.geometry.coordinates.length === 2
      ) {
        const [lon, lat] = feature.geometry.coordinates;
        markers.push({
          lat,
          lon,
          name: feature.properties?.name || feature.properties?.instrumentId || 'Instrument',
          instrumentId: feature.properties?.instrumentId || '',
          type: feature.properties?.type || '',
          status: feature.properties?.status || '',
        });
      }
    }
  }

  const clusterCount = clusters.length;
  const potentialClusterCount = clusters.filter(
    (c) => c.patternType === 'Potential Cluster'
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regional Geo-Spatial Intelligence"
        subtitle="Haversine proximity clusters, geographic similarity analysis and inspection density mapping."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Regional Intelligence' }]}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <Map className="w-5 h-5 text-teal-400 mb-2" />
          <p className="text-2xl font-extrabold text-white">{markers.length}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Instruments Mapped
          </p>
          {activeConfig && (
            <p className="text-[10px] text-slate-500 mt-1">
              Radius: {activeConfig.defaultRadiusKm || activeConfig.radiusKm || 'N/A'} km
            </p>
          )}
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <Users className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-extrabold text-amber-400">{potentialClusterCount}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Potential Clusters Detected
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {clusterCount} total regional correlations
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <Info className="w-5 h-5 text-purple-400 mb-2" />
          <p className="text-sm font-bold text-purple-300">
            {activeConfig?.name || 'No Active Config'}
          </p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
            Regional Config
          </p>
          {activeConfig && (
            <p className="text-[10px] text-slate-500 mt-1">
              v{activeConfig.version || 1}
            </p>
          )}
        </div>
      </div>

      {/* Interactive Map */}
      <Card
        title="Statewide Legal Metrology GIS Map"
        subtitle="Live instrument positions from backend GeoJSON. Each marker represents a registered instrument."
      >
        <div className="h-[480px] w-full rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl">
          {markers.length > 0 ? (
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={5}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {markers.map((m, i) => (
                <Marker key={i} position={[m.lat, m.lon]}>
                  <Popup>
                    <div className="p-1 font-sans">
                      <h4 className="font-bold text-slate-100 text-sm">{m.name}</h4>
                      <p className="text-xs text-slate-300">
                        {m.instrumentId} • {m.type}
                      </p>
                      <p className="text-xs mt-0.5 font-semibold">
                        Status:{' '}
                        <span
                          className={
                            m.status === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'
                          }
                        >
                          {m.status || '–'}
                        </span>
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={5}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={[20.5937, 78.9629]}
                radius={500000}
                pathOptions={{ color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.04, dashArray: '6' }}
              />
            </MapContainer>
          )}
        </div>
        {markers.length === 0 && (
          <p className="text-xs text-slate-500 text-center mt-3">
            No instruments with GPS coordinates found. Use "Generate Demo Data" on the Admin Dashboard to populate the map.
          </p>
        )}
      </Card>

      {/* Cluster table */}
      {clusters.length > 0 && (
        <Card
          title="Identified Potential Clusters"
          subtitle="Regional correlations detected by Haversine proximity analysis — decision support only."
        >
          <div className="divide-y divide-slate-800">
            {clusters.map((cluster: any, i: number) => (
              <div key={cluster._id || i} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-teal-400 font-bold">
                      {cluster.instrumentIdSnapshot || cluster.assessmentId}
                    </span>
                    <Badge variant={patternVariant(cluster.patternType)}>
                      {cluster.patternType}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    Radius: {cluster.radiusKm} km •{' '}
                    {cluster.similarInstruments?.length || 0} similar instruments nearby
                  </p>
                  <p className="text-xs text-amber-400 mt-1 font-medium">
                    {cluster.recommendedAction}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-slate-100">
                    {cluster.highestSimilarityScore?.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">Peak Similarity</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Avg: {cluster.averageSimilarityScore?.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-900/60 border border-amber-500/20 rounded-xl flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold text-amber-400">Decision Support Only:</span>{' '}
              "Potential Cluster" and "Correlation" patterns are AI decision support outputs and do not constitute
              confirmed fraud or enforcement findings. Final statutory authority remains with the authorized Inspector/LMO.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
