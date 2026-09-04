import { Router } from 'express';
import { complaintController } from '../controllers/complaint.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), complaintController.listComplaints.bind(complaintController));
router.get('/:complaintId', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), complaintController.getComplaintDetails.bind(complaintController));
router.patch('/:complaintId/status', authorizeRoles('ADMIN'), complaintController.updateComplaintStatus.bind(complaintController));

export default router;
