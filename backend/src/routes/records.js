import { Router } from 'express';
import { updateRecord, deleteRecord } from '../controllers/recordsController.js';

const router = Router();

router.put('/:recordId',    updateRecord);
router.delete('/:recordId', deleteRecord);

export default router;
