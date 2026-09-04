import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { searchController } from '../controllers/search.controller';

const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => searchController.search(req, res, next));

export default router;
