import { Router } from 'express';
import {
  getAllLogs,
  createLog,
  deleteLog,
  getLogById,
} from '../controllers/logsController.js';

const router = Router();

router.get('/', getAllLogs);
router.post('/', createLog);
router.get('/:id', getLogById);
router.delete('/:id', deleteLog);

export default router;
