import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publicService } from '../services/public.service';
import { certificateService } from '../services/certificate.service';
import { searchService } from '../services/search.service';
import { auditService } from '../services/audit.service';
import { demoService } from '../services/demo.service';
import { verificationService } from '../services/verification.service';
import { apiClient } from '../services/api';

describe('SmartMetrix Frontend Batch 2 Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  it('unwraps the certificate list response used by the certificates page', async () => {
    const certificates = [{ certificateNumber: 'CERT-2026-00001' }];
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { status: 'success', data: { certificates } },
    } as any);

    await expect(certificateService.listCertificates()).resolves.toEqual(certificates);
  });

  it('uses the mounted audit-log route and unwraps its pagination envelope', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { status: 'success', data: [{ auditId: 'AUD-1' }], pagination: { total: 1, page: 1, limit: 20, pages: 1 } },
    } as any);

    const response = await auditService.getAuditLogs({ page: 1 });
    expect(get).toHaveBeenCalledWith('/audit-logs', { params: { page: 1 } });
    expect(response.logs).toHaveLength(1);
  });

  it('uses the mounted admin demo-data route and unwraps the response', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { status: 'success', data: { batchId: 'DEMO-1' } },
    } as any);

    await expect(demoService.generateDemoData({ count: 100 })).resolves.toEqual({ batchId: 'DEMO-1' });
    expect(post).toHaveBeenCalledWith('/admin/demo-data/generate', { count: 100 });
  });

  it('submits the backend verification contract without legacy notes fields', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { status: 'success', data: { verification: { requestId: 'VRF-2026-00001' } } },
    } as any);
    const payload = { instrumentId: 'WM-2026-00001', verificationType: 'INITIAL' as const, remarks: 'Initial verification' };

    await verificationService.createVerificationRequest(payload);
    expect(post).toHaveBeenCalledWith('/verifications', payload);
  });

  it('maps frontend search types and flattens grouped backend results', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        status: 'success',
        data: {
          results: { instruments: [{ _id: '1', instrumentId: 'WM-2026-00001', manufacturer: 'Acme', model: 'X1', status: 'ACTIVE' }] },
          pagination: { page: 1, limit: 20 },
        },
      },
    } as any);

    const response = await searchService.search({ entityType: 'INSTRUMENT' });
    expect(get).toHaveBeenCalledWith('/search', { params: { entityType: 'instruments' } });
    expect(response.results[0]).toMatchObject({ entityType: 'INSTRUMENT', title: 'WM-2026-00001', subtitle: 'Acme X1' });
  });
});
