import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/dashboard', (req, res, next) => analyticsController.getDashboardKpis(req, res, next));
router.get('/verification-distribution', (req, res, next) => analyticsController.getVerificationDistribution(req, res, next));
router.get('/risk-distribution', (req, res, next) => analyticsController.getRiskDistribution(req, res, next));
router.get('/pass-fail-trends', (req, res, next) => analyticsController.getPassFailTrends(req, res, next));
router.get('/certificate-validity', (req, res, next) => analyticsController.getCertificateValidity(req, res, next));
router.get('/city-distribution', (req, res, next) => analyticsController.getCityDistribution(req, res, next));
router.get('/improvement-notice-status', (req, res, next) => analyticsController.getImprovementNoticeStatus(req, res, next));
router.get('/complaint-status', (req, res, next) => analyticsController.getComplaintStatus(req, res, next));
router.get('/anomaly-cluster-counts', (req, res, next) => analyticsController.getAnomalyAndClusterCounts(req, res, next));
router.get('/priority-inspections', (req, res, next) => analyticsController.getPriorityInspections(req, res, next));

export default router;
