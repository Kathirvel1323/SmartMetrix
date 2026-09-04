import crypto from 'crypto';

const DEFAULT_HMAC_SECRET = 'smartmetrix_cert_integrity_secret_2026_key_32_chars';
const DEFAULT_AES_KEY = '0123456789abcdef0123456789abcdef'; // 32 hex chars / 16 bytes key (or 64 hex chars for 32 bytes)

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
  const secret = process.env.CERTIFICATE_INTEGRITY_SECRET || DEFAULT_HMAC_SECRET;

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
  const rawKey = process.env.COMPLAINT_ENCRYPTION_KEY || DEFAULT_AES_KEY;
  // Ensure key is 32 bytes
  const key = crypto.createHash('sha256').update(rawKey).digest();
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
    const rawKey = process.env.COMPLAINT_ENCRYPTION_KEY || DEFAULT_AES_KEY;
    const key = crypto.createHash('sha256').update(rawKey).digest();
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
