import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { instrumentService } from '../../services/instrument.service';
import { AlertCircle, Scale, CheckCircle } from 'lucide-react';

interface RegisterInstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterInstrumentModal: React.FC<RegisterInstrumentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    type: 'WEIGHING_SCALE',
    category: 'NON_AUTOMATIC_WEIGHING',
    manufacturer: '',
    model: '',
    serialNumber: '',
    capacityValue: '',
    capacityUnit: 'kg',
    address: '',
    city: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
    longitude: '',
    latitude: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      await instrumentService.registerInstrument({
        type: formData.type,
        category: formData.category,
        manufacturer: formData.manufacturer,
        model: formData.model,
        serialNumber: formData.serialNumber,
        capacity: { value: Number(formData.capacityValue), unit: formData.capacityUnit },
        location: {
          address: formData.address,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          coordinates: {
            type: 'Point',
            coordinates: [Number(formData.longitude), Number(formData.latitude)],
          },
        },
      });

      setSuccessMessage('Instrument successfully registered in Legal Metrology Passport Registry!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register instrument. Please check all fields.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Legal Metrology Instrument"
      subtitle="Issue a new digital passport and log instrument specifications in the legal registry."
      maxWidth="2xl"
    >
      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center gap-3 text-red-300 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Instrument Class / Type *"
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            options={[
              { label: 'Weighing Scale (Class III)', value: 'WEIGHING_SCALE' },
              { label: 'Fuel Dispenser Pump', value: 'FUEL_PUMP' },
              { label: 'Bulk Flow Meter', value: 'FLOW_METER' },
              { label: 'Linear Length Measure', value: 'LENGTH_MEASURE' },
            ]}
          />

          <Input
            label="Manufacturer *"
            placeholder="e.g. Mettler Toledo / Avery India"
            value={formData.manufacturer}
            onChange={(e) => handleChange('manufacturer', e.target.value)}
            required
          />

          <Input
            label="Model Number *"
            placeholder="e.g. MT-8000-X"
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            required
          />

          <Input
            label="Serial Number (Unique Instrument Serial No.) *"
            placeholder="e.g. SN-2026-88941"
            value={formData.serialNumber}
            onChange={(e) => handleChange('serialNumber', e.target.value)}
            required
          />

          <div className="flex gap-2">
            <Input
              label="Capacity Value *"
              type="number"
              placeholder="e.g. 500"
              value={formData.capacityValue}
              onChange={(e) => handleChange('capacityValue', e.target.value)}
              className="w-2/3"
              required
            />
            <Select
              label="Unit"
              value={formData.capacityUnit}
              onChange={(e) => handleChange('capacityUnit', e.target.value)}
              options={[
                { label: 'kg', value: 'kg' },
                { label: 'g', value: 'g' },
                { label: 'Liters (L)', value: 'L' },
                { label: 'Meters (m)', value: 'm' },
              ]}
              className="w-1/3"
            />
          </div>
        </div>

        {/* Location Section */}
        <div className="pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3">
            Installation Location & Geo Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Street Address *"
              placeholder="Plot 42, Industrial Area Phase II"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              required
            />
            <Input
              label="State *"
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              required
            />
            <Input
              label="City *"
              placeholder="e.g. Chennai / Coimbatore"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              required
            />
            <Input
              label="Longitude *"
              type="number"
              value={formData.longitude}
              onChange={(e) => handleChange('longitude', e.target.value)}
              placeholder="e.g. 76.9558"
              required
            />
            <Input
              label="Latitude *"
              type="number"
              value={formData.latitude}
              onChange={(e) => handleChange('latitude', e.target.value)}
              placeholder="e.g. 11.0168"
              required
            />
            <Input
              label="District *"
              placeholder="e.g. Thane"
              value={formData.district}
              onChange={(e) => handleChange('district', e.target.value)}
              required
            />
            <Input
              label="Pincode *"
              placeholder="e.g. 400001"
              value={formData.pincode}
              onChange={(e) => handleChange('pincode', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            icon={<Scale className="w-4 h-4" />}
          >
            Register Instrument
          </Button>
        </div>
      </form>
    </Modal>
  );
};
