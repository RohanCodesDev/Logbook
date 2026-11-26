import { Router } from 'express';
import { updateSection, deleteSection } from '../controllers/sectionsController.js';
import { createField, reorderFields } from '../controllers/fieldsController.js';
import { getRecordsBySection, createRecord } from '../controllers/recordsController.js';

const router = Router();

// Section management
router.put('/:sectionId',    updateSection);
router.delete('/:sectionId', deleteSection);

// Fields inside a section
router.post('/:sectionId/fields',         createField);
router.put('/:sectionId/fields/reorder',  reorderFields);

// Records inside a section
router.get('/:sectionId/records',  getRecordsBySection);
router.post('/:sectionId/records', createRecord);

export default router;
