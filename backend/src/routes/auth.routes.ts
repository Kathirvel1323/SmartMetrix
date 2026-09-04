import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  createInspector
} from '../controllers/auth.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (any authenticated user)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

// Admin-only protected route
router.post('/inspector', authenticate, authorizeRoles('ADMIN'), createInspector);

export default router;
