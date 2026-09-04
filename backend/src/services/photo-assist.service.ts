import mongoose from 'mongoose';
import { PhotoAssistAssessment, IPhotoAssistAssessment } from '../models/photo-assist.model';
import { Instrument } from '../models/instrument.model';
import { Inspection } from '../models/inspection.model';
import { aiServiceClient } from './ai-client.service';
import { generatePhotoAssistId } from '../utils/phase7-id.utils';
import { IUser } from '../models/user.model';

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

    let inspectionObjId: mongoose.Types.ObjectId | undefined;
    if (inspectionId) {
      const insp = await Inspection.findOne({ inspectionId: inspectionId.trim().toUpperCase() });
      if (insp) inspectionObjId = insp._id as mongoose.Types.ObjectId;
    }

    // Call FastAPI service
    const aiRes = await aiServiceClient.analyzePhoto(imageBuffer, filename);

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
