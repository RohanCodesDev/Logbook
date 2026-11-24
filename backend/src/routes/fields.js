import { Router } from 'express';
import { updateField, deleteField } from '../controllers/fieldsController.js';

const router = Router();

router.put('/:fieldId',    updateField);
router.delete('/:fieldId', deleteField);

export default router;
