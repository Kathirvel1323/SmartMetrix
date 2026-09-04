import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';

export const RegionalIntelligencePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Regional Geo-Spatial Intelligence"
        subtitle="Geographic similarity, Haversine proximity clusters & inspection density heatmaps."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Regional Intelligence' }]}
      />

      <Card title="Statewide Legal Metrology Map" subtitle="Interactive geospatial heatmap & inspector coverage">
        <div className="h-[500px] w-full rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl">
          <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={true} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[19.076, 72.8777]}>
              <Popup>
                <div className="p-1 font-sans">
                  <h4 className="font-bold text-slate-100">Mumbai West District</h4>
                  <p className="text-xs text-slate-300">420 Instruments • 94% Verified</p>
                </div>
              </Popup>
            </Marker>
            <Circle center={[19.076, 72.8777]} radius={50000} pathOptions={{ color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.2 }} />

            <Marker position={[28.6139, 77.209]}>
              <Popup>
                <div className="p-1 font-sans">
                  <h4 className="font-bold text-slate-100">Delhi Central Division</h4>
                  <p className="text-xs text-slate-300">380 Instruments • 89% Verified</p>
                </div>
              </Popup>
            </Marker>
            <Circle center={[28.6139, 77.209]} radius={40000} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 }} />

            <Marker position={[12.9716, 77.5946]}>
              <Popup>
                <div className="p-1 font-sans">
                  <h4 className="font-bold text-slate-100">Bengaluru Urban Sector</h4>
                  <p className="text-xs text-slate-300">510 Instruments • 96% Verified</p>
                </div>
              </Popup>
            </Marker>
            <Circle center={[12.9716, 77.5946]} radius={45000} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 }} />
          </MapContainer>
        </div>
      </Card>
    </div>
  );
};
