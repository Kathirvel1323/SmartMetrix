import { Router } from 'express';
import { certificateController } from '../controllers/certificate.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Policy endpoints - ADMIN
router.post('/policies', authorizeRoles('ADMIN'), certificateController.createPolicy.bind(certificateController));
router.post('/policies/:policyId/activate', authorizeRoles('ADMIN'), certificateController.activatePolicy.bind(certificateController));
router.post('/policies/:policyId/deactivate', authorizeRoles('ADMIN'), certificateController.deactivatePolicy.bind(certificateController));
router.get('/policies', authorizeRoles('ADMIN', 'INSPECTOR'), certificateController.listPolicies.bind(certificateController));

// Certificate endpoints
router.post('/issue', authorizeRoles('ADMIN'), certificateController.issueCertificate.bind(certificateController));
router.post('/:certificateNumber/revoke', authorizeRoles('ADMIN'), certificateController.revokeCertificate.bind(certificateController));
router.get('/:certificateNumber', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), certificateController.getCertificate.bind(certificateController));
router.get('/', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), certificateController.listCertificates.bind(certificateController));

export default router;
