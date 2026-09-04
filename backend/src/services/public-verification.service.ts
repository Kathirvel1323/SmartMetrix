import QRCode from 'qrcode';
import { Certificate } from '../models/certificate.model';
import { verifyIntegritySeal } from '../utils/crypto-seal.utils';

export interface PublicVerificationResponse {
  certificateNumber: string;
  publicVerificationId: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';
  instrument: {
    instrumentId: string;
    type: string;
    category: string;
    manufacturer: string;
    model: string;
    maskedSerialNumber: string;
  };
  verificationDate: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  integrityStatus: 'VALID' | 'COMPROMISED';
  issuingAuthorityLabel: string;
  disclaimer: string;
}

export class PublicVerificationService {
  async verifyPublicCertificate(publicVerificationId: string): Promise<PublicVerificationResponse> {
    const cert = await Certificate.findOne({ publicVerificationId: publicVerificationId.trim() });
    if (!cert) {
      throw Object.assign(new Error('Public verification record not found'), { statusCode: 404 });
    }

    const now = new Date();
    let effectiveStatus = cert.status;
    if (cert.status === 'VALID' && cert.expiresAt < now) {
      effectiveStatus = 'EXPIRED';
    }

    const safePayload = {
      certificateNumber: cert.certificateNumber,
      publicVerificationId: cert.publicVerificationId,
      instrumentId: cert.instrumentSnapshot.instrumentId,
      type: cert.instrumentSnapshot.type,
      category: cert.instrumentSnapshot.category,
      manufacturer: cert.instrumentSnapshot.manufacturer,
      model: cert.instrumentSnapshot.model,
      maskedSerialNumber: cert.instrumentSnapshot.maskedSerialNumber,
      verificationDate: cert.verificationDate.toISOString(),
      issuedAt: cert.issuedAt.toISOString(),
      validFrom: cert.validFrom.toISOString(),
      expiresAt: cert.expiresAt.toISOString(),
      inspectorResult: cert.inspectionSnapshot.inspectorResult
    };

    const isIntegrityValid = verifyIntegritySeal(
      safePayload,
      cert.integrityMetadata.payloadHash,
      cert.integrityMetadata.hmacSeal
    );

    return {
      certificateNumber: cert.certificateNumber,
      publicVerificationId: cert.publicVerificationId,
      status: effectiveStatus,
      instrument: {
        instrumentId: cert.instrumentSnapshot.instrumentId,
        type: cert.instrumentSnapshot.type,
        category: cert.instrumentSnapshot.category,
        manufacturer: cert.instrumentSnapshot.manufacturer,
        model: cert.instrumentSnapshot.model,
        maskedSerialNumber: cert.instrumentSnapshot.maskedSerialNumber
      },
      verificationDate: cert.verificationDate.toISOString(),
      issuedAt: cert.issuedAt.toISOString(),
      validFrom: cert.validFrom.toISOString(),
      expiresAt: cert.expiresAt.toISOString(),
      integrityStatus: isIntegrityValid ? 'VALID' : 'COMPROMISED',
      issuingAuthorityLabel: 'Authorized Legal Metrology Authority',
      disclaimer: 'Public verification decision support data only. Stripped of sensitive owner data, GPS coordinates, and internal IDs.'
    };
  }

  async generateQrCodeBuffer(publicVerificationId: string): Promise<Buffer> {
    // Ensure public verification record exists
    const cert = await Certificate.findOne({ publicVerificationId: publicVerificationId.trim() });
    if (!cert) {
      throw Object.assign(new Error('Public verification record not found'), { statusCode: 404 });
    }

    const publicAppUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const verificationUrl = `${publicAppUrl}/verify/${cert.publicVerificationId}`;

    const pngBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 300,
      margin: 2
    });

    return pngBuffer;
  }
}

export const publicVerificationService = new PublicVerificationService();
