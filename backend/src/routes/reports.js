import { Router } from 'express';
import { getBusinessReport } from '../controllers/reportsController.js';

const router = Router();

router.get('/', getBusinessReport);

export default router;
