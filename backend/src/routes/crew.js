import { Router } from 'express';
import {
  getAllCrew,
  createCrewMember,
  updateCrewMember,
  deleteCrewMember,
  logCrewWagesToSpend,
} from '../controllers/crewController.js';

const router = Router();

router.get('/',          getAllCrew);
router.post('/',         createCrewMember);
router.post('/log-wages', logCrewWagesToSpend);
router.put('/:id',       updateCrewMember);
router.delete('/:id',    deleteCrewMember);

export default router;
