import crypto from 'crypto';

export function getCertificateIntegritySecret(): string {
  const secret = process.env.CERTIFICATE_INTEGRITY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('CERTIFICATE_INTEGRITY_SECRET must be configured and at least 32 characters long');
  }
  return secret;
}

export function getComplaintEncryptionKey(): Buffer {
  const rawKey = process.env.COMPLAINT_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('COMPLAINT_ENCRYPTION_KEY is not configured in environment variables');
  }
  let keyBuf: Buffer;
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    keyBuf = Buffer.from(rawKey, 'hex');
  } else {
    keyBuf = Buffer.from(rawKey, 'utf-8');
  }
  if (keyBuf.length !== 32) {
    throw new Error('COMPLAINT_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters or 32 raw bytes)');
  }
  return keyBuf;
}

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  encryptedData: string;
}

export interface IntegritySealResult {
  payloadHash: string;
  hmacSeal: string;
  algorithm: string;
  label: string;
}

/**
 * Creates canonical SHA-256 hash and HMAC-SHA256 seal for tamper-evident certificate metadata.
 */
export function createIntegritySeal(payload: Record<string, any>): IntegritySealResult {
  const secret = getCertificateIntegritySecret();

  // Sort keys recursively for canonical JSON representation
  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());

  const payloadHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');
  const hmacSeal = crypto.createHmac('sha256', secret).update(payloadHash).digest('hex');

  return {
    payloadHash,
    hmacSeal,
    algorithm: 'HMAC-SHA256',
    label: 'tamper-evident integrity metadata'
  };
}

/**
 * Verifies certificate payload against stored payloadHash and hmacSeal.
 */
export function verifyIntegritySeal(payload: Record<string, any>, expectedHash: string, expectedSeal: string): boolean {
  try {
    const seal = createIntegritySeal(payload);
    const hashMatches = crypto.timingSafeEqual(Buffer.from(seal.payloadHash), Buffer.from(expectedHash));
    const sealMatches = crypto.timingSafeEqual(Buffer.from(seal.hmacSeal), Buffer.from(expectedSeal));
    return hashMatches && sealMatches;
  } catch {
    return false;
  }
}

/**
 * Encrypts sensitive complainant contact data at rest using AES-256-GCM.
 */
export function encryptContact(plainText: string): EncryptedPayload {
  const key = getComplaintEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted
  };
}

/**
 * Decrypts AES-256-GCM encrypted complainant contact data.
 */
export function decryptContact(payload: EncryptedPayload): string {
  try {
    const key = getComplaintEncryptionKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[Decryption Failed]';
  }
}
