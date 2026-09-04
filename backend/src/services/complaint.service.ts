import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Complaint, IComplaint, ComplaintCategory, ComplaintStatus } from '../models/complaint.model';
import { Certificate } from '../models/certificate.model';
import { Instrument } from '../models/instrument.model';
import { IUser } from '../models/user.model';
import { generateComplaintId } from '../utils/phase8-id.utils';
import { encryptContact, decryptContact } from '../utils/crypto-seal.utils';

export interface SubmitComplaintDTO {
  publicVerificationId: string;
  category: ComplaintCategory;
  description: string;
  complainantContact?: string;
}

export class ComplaintService {
  async submitPublicComplaint(dto: SubmitComplaintDTO) {
    if (!dto.publicVerificationId || !dto.description || dto.description.trim().length < 10) {
      throw Object.assign(new Error('publicVerificationId and a detailed description (min 10 chars) are required'), { statusCode: 400 });
    }

    const cert = await Certificate.findOne({ publicVerificationId: dto.publicVerificationId.trim() });
    if (!cert) {
      throw Object.assign(new Error('Invalid publicVerificationId: No matching certificate found'), { statusCode: 404 });
    }

    const trackingToken = uuidv4();
    const complaintId = await generateComplaintId();

    let encryptedContactData;
    if (dto.complainantContact && dto.complainantContact.trim().length > 0) {
      const enc = encryptContact(dto.complainantContact.trim());
      encryptedContactData = {
        iv: enc.iv,
        authTag: enc.authTag,
        encryptedData: enc.encryptedData
      };
    }

    const now = new Date();
    const complaint = new Complaint({
      complaintId,
      trackingToken,
      certificate: cert._id,
      instrument: cert.instrument,
      publicVerificationId: cert.publicVerificationId,
      category: dto.category || 'OTHER',
      description: dto.description.trim(),
      encryptedContact: encryptedContactData,
      status: 'SUBMITTED',
      submittedAt: now,
      statusHistory: [
        {
          status: 'SUBMITTED',
          timestamp: now,
          remarks: 'Complaint submitted by public consumer'
        }
      ]
    });

    await complaint.save();

    return {
      complaintId: complaint.complaintId,
      trackingToken: complaint.trackingToken,
      status: complaint.status,
      submittedAt: complaint.submittedAt,
      message: 'Complaint submitted successfully. Please save your tracking token to check status.'
    };
  }

  async trackPublicComplaint(trackingToken: string) {
    const complaint = await Complaint.findOne({ trackingToken: trackingToken.trim() });
    if (!complaint) {
      throw Object.assign(new Error('Complaint not found for this tracking token'), { statusCode: 404 });
    }

    return {
      complaintId: complaint.complaintId,
      status: complaint.status,
      category: complaint.category,
      submittedAt: complaint.submittedAt,
      updatedAt: complaint.updatedAt,
      resolutionSummary: complaint.resolutionSummary || 'Under process by Authorized Metrology Officers.',
      disclaimer: 'Public complaint tracking details only. Complainant contact details and internal notes are protected.'
    };
  }

  async listComplaints(caller: IUser) {
    if (caller.role === 'OWNER') {
      const ownedInstruments = await Instrument.find({ owner: caller._id }).select('_id');
      const ownedInstIds = ownedInstruments.map((i) => i._id);
      const complaints = await Complaint.find({ instrument: { $in: ownedInstIds } }).sort({ submittedAt: -1 });

      // Strip encryptedContact from OWNER view completely
      return complaints.map((c) => {
        const obj = c.toObject();
        delete (obj as any).encryptedContact;
        return obj;
      });
    }

    if (caller.role === 'INSPECTOR') {
      const complaints = await Complaint.find({ assignedTo: caller._id }).sort({ submittedAt: -1 });
      return complaints.map((c) => {
        const obj = c.toObject();
        delete (obj as any).encryptedContact;
        return obj;
      });
    }

    // ADMIN sees all complaints
    return Complaint.find({}).sort({ submittedAt: -1 });
  }

  async getComplaintDetails(complaintId: string, caller: IUser) {
    const complaint = await Complaint.findOne({ complaintId: complaintId.trim().toUpperCase() });
    if (!complaint) {
      throw Object.assign(new Error('Complaint not found'), { statusCode: 404 });
    }

    const obj = complaint.toObject();

    // Decrypt contact for ADMIN only
    if (caller.role === 'ADMIN' && complaint.encryptedContact && complaint.encryptedContact.encryptedData) {
      (obj as any).decryptedContact = decryptContact(complaint.encryptedContact as any);
    } else {
      delete (obj as any).encryptedContact;
    }

    return obj;
  }

  async updateComplaintStatus(
    complaintId: string,
    newStatus: ComplaintStatus,
    remarks: string,
    resolutionSummary: string | undefined,
    caller: IUser
  ) {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can update complaint status'), { statusCode: 403 });
    }

    const complaint = await Complaint.findOne({ complaintId: complaintId.trim().toUpperCase() });
    if (!complaint) {
      throw Object.assign(new Error('Complaint not found'), { statusCode: 404 });
    }

    const allowedTransitions: Record<ComplaintStatus, ComplaintStatus[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'DISMISSED'],
      UNDER_REVIEW: ['INVESTIGATING', 'DISMISSED'],
      INVESTIGATING: ['RESOLVED', 'DISMISSED'],
      RESOLVED: [],
      DISMISSED: []
    };

    if (!allowedTransitions[complaint.status].includes(newStatus)) {
      throw Object.assign(
        new Error(`Invalid status transition from ${complaint.status} to ${newStatus}`),
        { statusCode: 409 }
      );
    }

    const now = new Date();
    complaint.status = newStatus;
    if (resolutionSummary) complaint.resolutionSummary = resolutionSummary.trim();
    complaint.statusHistory.push({
      status: newStatus,
      timestamp: now,
      changedBy: caller._id as any,
      remarks: remarks ? remarks.trim() : `Status updated to ${newStatus}`
    });

    await complaint.save();
    return complaint;
  }
}

export const complaintService = new ComplaintService();
