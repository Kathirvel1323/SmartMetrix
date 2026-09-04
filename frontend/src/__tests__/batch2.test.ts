import { describe, it, expect } from 'vitest';
import { publicService } from '../services/public.service';
import { certificateService } from '../services/certificate.service';
import { searchService } from '../services/search.service';

describe('SmartMetrix Frontend Batch 2 Verification Suite', () => {
  it('Public verification service generates privacy-safe QR URLs without token', () => {
    const qrUrl = publicService.getQrImageUrl('PUB-VER-12345');
    expect(qrUrl).toContain('/api/public/verify/PUB-VER-12345/qr');
    expect(qrUrl).not.toContain('Bearer');
    expect(qrUrl).not.toContain('secret');
  });

  it('Certificate service exposes required list and revocation interfaces', () => {
    expect(typeof certificateService.listCertificates).toBe('function');
    expect(typeof certificateService.revokeCertificate).toBe('function');
  });

  it('Search service provides global search interface', () => {
    expect(typeof searchService.search).toBe('function');
  });
});
