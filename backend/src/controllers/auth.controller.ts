import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

/**
 * Register a new OWNER account
 * Public endpoint
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, phone, organization } = req.body;
    const result = await authService.register({ name, email, password, phone, organization });

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in an existing user
 * Public endpoint
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log out user (invalidates active token sessions)
 * Protected endpoint
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
      return;
    }

    await authService.logout(req.user._id.toString());

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully. Active sessions invalidated.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * Protected endpoint
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
      return;
    }

    const user = await authService.getProfile(req.user._id.toString());

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin endpoint: Create an INSPECTOR account
 * Protected: ADMIN only
 */
export const createInspector = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const inspector = await authService.createInspector({ name, email, password });

    res.status(201).json({
      status: 'success',
      message: 'Inspector account created successfully',
      data: { user: inspector }
    });
  } catch (error) {
    next(error);
  }
};
