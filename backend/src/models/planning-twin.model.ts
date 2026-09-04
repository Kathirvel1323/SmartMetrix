import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPlanningTwinRepresentation {
  instrumentId: string;
  type: string;
  category: string;
  capacity: { value: number; unit: string };
  coordinates: [number, number];
  inspectionHistorySummary: {
    totalFinalized: number;
    passCount: number;
    failCount: number;
    meanAbsDeviationPct: number | null;
  };
  configuredMethod?: string;
  requiredEquipment?: string[];
  estimatedEffortHours?: number;
  missingDataIndicators: string[];
  disclaimer: string;
}

export interface IVerificationBurdenPlan {
  planId: string;
  rank: number;
  verificationMethod: string;
  facilityId: string;
  facilityName: string;
  facilityLocation: { city: string; state: string; distanceKm: number };
  requiredEquipment: string[];
  equipmentAvailable: boolean;
  missingEquipment: string[];
  estimatedEffortHours: number;
  burdenScore: number; // lower is better
  reasons: string[];
  disclaimer: string;
}
