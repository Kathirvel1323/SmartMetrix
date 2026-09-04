import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.utils';
import { User, IUser, UserRole } from '../models/user.model';

// Extend Express Request type to attach authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Middleware to authenticate requests via JWT Bearer token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required. No token provided.'
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded: TokenPayload = verifyToken(token);

    // Fetch user from database to verify active status and session validity
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid session. User no longer exists.'
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        status: 'error',
        message: 'Account is deactivated. Please contact support.'
      });
      return;
    }

    // Check token version to support instant logout and session revocation
    if (user.tokenVersion !== decoded.tokenVersion) {
      res.status(401).json({
        status: 'error',
        message: 'Token has been invalidated. Please log in again.'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        status: 'error',
        message: 'Authentication token has expired. Please log in again.'
      });
      return;
    }

    res.status(401).json({
      status: 'error',
      message: 'Invalid authentication token.'
    });
  }
};

/**
 * Middleware to authorize requests based on user roles (RBAC)
 */
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required.'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        message: `Access forbidden: Insufficient permissions. Required role(s): [${roles.join(
          ', '
        )}]. Your role: ${req.user.role}`
      });
      return;
    }

    next();
  };
};
