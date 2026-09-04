import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { UserRole } from '../models/user.model';

export interface TokenPayload {
  id: string;
  role: UserRole;
  tokenVersion: number;
}

const JWT_ALGORITHM = 'HS256';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return secret;
};

const getJwtExpiresIn = (): string => {
  return process.env.JWT_EXPIRES_IN || '7d';
};

/**
 * Generates a signed JSON Web Token containing user ID, role, and tokenVersion.
 * Enforces HS256 algorithm.
 */
export const generateToken = (payload: TokenPayload): string => {
  const secret = getJwtSecret();
  const expiresIn = getJwtExpiresIn();

  const options: SignOptions = {
    expiresIn: expiresIn as any,
    algorithm: JWT_ALGORITHM
  };

  return jwt.sign(payload, secret, options);
};

/**
 * Verifies a JWT token, strictly restricts algorithm to HS256,
 * and structurally validates the payload.
 */
export const verifyToken = (token: string): TokenPayload => {
  const secret = getJwtSecret();

  const verifyOptions: VerifyOptions = {
    algorithms: [JWT_ALGORITHM]
  };

  const decoded = jwt.verify(token, secret, verifyOptions) as any;

  // Structural validation of decoded payload
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    typeof decoded.id !== 'string' ||
    decoded.id.trim().length === 0 ||
    typeof decoded.tokenVersion !== 'number' ||
    !Number.isInteger(decoded.tokenVersion) ||
    decoded.tokenVersion < 0
  ) {
    const error: any = new Error('Invalid token payload structure');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  return {
    id: decoded.id,
    role: decoded.role,
    tokenVersion: decoded.tokenVersion
  };
};
