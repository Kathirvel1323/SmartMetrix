import mongoose from 'mongoose';
import { PhotoAssistAssessment, IPhotoAssistAssessment } from '../models/photo-assist.model';
import { Instrument } from '../models/instrument.model';
import { Inspection } from '../models/inspection.model';
import { aiServiceClient } from './ai-client.service';
import { generatePhotoAssistId } from '../utils/phase7-id.utils';
import { IUser } from '../models/user.model';
import { VerificationRequest } from '../models/verification-request.model';
import sharp from 'sharp';

export const analyzeImageLocally = async (imageBuffer: Buffer) => {
  const { data, info } = await sharp(imageBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height || data.length === 0) {
    throw Object.assign(new Error('Invalid or unsupported image file'), { statusCode: 400 });
  }

  let sum = 0;
  for (const value of data) sum += value;
  const mean = sum / data.length;

  let varianceSum = 0;
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const value = data[index];
      varianceSum += (value - mean) ** 2;
      if (x + 1 < info.width) {
        edgeSum += Math.abs(value - data[index + 1]);
        edgeCount += 1;
      }
      if (y + 1 < info.height) {
        edgeSum += Math.abs(value - data[index + info.width]);
        edgeCount += 1;
      }
    }
  }

  const brightnessScore = Number(((mean / 255) * 100).toFixed(2));
  const contrastScore = Number((Math.min(100, (Math.sqrt(varianceSum / data.length) / 128) * 100)).toFixed(2));
  const sharpnessScore = Number((Math.min(100, ((edgeSum / Math.max(1, edgeCount)) / 20) * 100)).toFixed(2));
  const overallQualityScore = Number((brightnessScore * 0.3 + contrastScore * 0.3 + sharpnessScore * 0.4).toFixed(2));
  const irregularities: string[] = [];
  if (brightnessScore < 25) irregularities.push('LOW_LIGHTING: Image appears underexposed or dark.');
  if (brightnessScore > 85) irregularities.push('OVEREXPOSURE: Image appears excessively bright.');
  if (contrastScore < 20) irregularities.push('LOW_CONTRAST: Image details may be washed out.');
  if (sharpnessScore < 15) irregularities.push('BLURRY_IMAGE: Low sharpness detected; manual re-capture suggested.');

  return {
    status: 'SUCCESS' as const,
    qualityMetrics: {
      resolution: { width: info.width, height: info.height },
      brightnessScore,
      contrastScore,
      sharpnessScore,
      overallQualityScore
    },
    semanticFields: {
      seal_intact: 'NOT_ASSESSED' as const,
      model_plate_legible: 'MANUAL_REVIEW_REQUIRED' as const,
      serial_number_match: 'NOT_ASSESSED' as const,
      tampering_detected: 'NOT_ASSESSED' as const
    },
    irregularities,
    disclaimer: 'Decision support output only. Local image-quality fallback was used; final statutory review remains with the authorized Inspector/LMO.'
  };
};

export class PhotoAssistService {
  async analyzePhotoQuality(
    instrumentId: string,
    imageBuffer: Buffer,
    filename: string,
    caller: IUser,
    inspectionId?: string
  ): Promise<IPhotoAssistAssessment> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or assigned INSPECTOR can run Photo Assist analysis'), { statusCode: 403 });
    }

    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'INSPECTOR') {
      const assignedRequest = await VerificationRequest.exists({
        instrument: inst._id,
        assignedInspector: caller._id,
        status: { $in: ['ASSIGNED', 'SCHEDULED', 'PASSED', 'FAILED', 'CERTIFICATE_ISSUED'] }
      });
      if (!assignedRequest) {
        throw Object.assign(new Error('You are not assigned to this instrument'), { statusCode: 403 });
      }
    }

    let inspectionObjId: mongoose.Types.ObjectId | undefined;
    if (inspectionId) {
      const insp = await Inspection.findOne({ inspectionId: inspectionId.trim().toUpperCase() });
      if (insp) inspectionObjId = insp._id as mongoose.Types.ObjectId;
    }

    // Call FastAPI service
    let aiRes;
    try {
      aiRes = await aiServiceClient.analyzePhoto(imageBuffer, filename);
    } catch (error: any) {
      if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      try {
        aiRes = await analyzeImageLocally(imageBuffer);
      } catch {
        throw Object.assign(new Error('Invalid or unsupported image file'), { statusCode: 400 });
      }
    }

    const assessmentId = await generatePhotoAssistId();
    const assessment = new PhotoAssistAssessment({
      assessmentId,
      inspection: inspectionObjId,
      instrument: inst._id,
      instrumentIdSnapshot: inst.instrumentId,
      qualityMetrics: aiRes.qualityMetrics,
      semanticFields: aiRes.semanticFields,
      irregularities: aiRes.irregularities,
      disclaimer: aiRes.disclaimer || 'Decision support output only. Does not alter statutory inspection results or constitute legal proof of defect or tampering.',
      assessedBy: caller._id,
      assessedAt: new Date()
    });

    await assessment.save();
    return assessment;
  }

  async getLatestPhotoAssist(instrumentId: string, caller: IUser) {
    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER' && inst.owner.toString() !== (caller._id as any).toString()) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const latest = await PhotoAssistAssessment.findOne({ instrument: inst._id })
      .sort({ assessedAt: -1 })
      .populate('assessedBy', 'name role -_id');

    if (!latest) {
      throw Object.assign(new Error('No Photo Assist assessment found for this instrument'), { statusCode: 404 });
    }
    return latest;
  }
}

export const photoAssistService = new PhotoAssistService();
