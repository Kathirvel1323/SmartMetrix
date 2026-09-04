import { Router, Request, Response } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

/**
 * Protected test endpoint for OWNER role
 */
router.get(
  '/owner',
  authenticate,
  authorizeRoles('OWNER'),
  (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Access granted: OWNER role verified.',
      user: {
        id: req.user?._id,
        name: req.user?.name,
        email: req.user?.email,
        role: req.user?.role
      }
    });
  }
);

/**
 * Protected test endpoint for INSPECTOR role
 */
router.get(
  '/inspector',
  authenticate,
  authorizeRoles('INSPECTOR'),
  (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Access granted: INSPECTOR role verified.',
      user: {
        id: req.user?._id,
        name: req.user?.name,
        email: req.user?.email,
        role: req.user?.role
      }
    });
  }
);

/**
 * Protected test endpoint for ADMIN role
 */
router.get(
  '/admin',
  authenticate,
  authorizeRoles('ADMIN'),
  (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Access granted: ADMIN role verified.',
      user: {
        id: req.user?._id,
        name: req.user?.name,
        email: req.user?.email,
        role: req.user?.role
      }
    });
  }
);

export default router;
