import { Router } from 'express';
import {
  registerInstrument,
  listInstruments,
  getInstrumentById,
  updateInstrument,
  archiveInstrument,
  getPassport
} from '../controllers/instrument.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All instrument endpoints require authentication
router.use(authenticate);

// POST /api/instruments - Register new instrument (OWNER or ADMIN)
router.post('/', registerInstrument);

// GET /api/instruments - List instruments with filters & pagination
router.get('/', listInstruments);

// GET /api/instruments/:instrumentId - Get single instrument details
router.get('/:instrumentId', getInstrumentById);

// PATCH /api/instruments/:instrumentId - Update safe editable details
router.patch('/:instrumentId', updateInstrument);

// POST /api/instruments/:instrumentId/archive - Soft archive (ADMIN only)
router.post('/:instrumentId/archive', authorizeRoles('ADMIN'), archiveInstrument);

// GET /api/instruments/:instrumentId/passport - Digital Instrument Passport
router.get('/:instrumentId/passport', getPassport);

export default router;
