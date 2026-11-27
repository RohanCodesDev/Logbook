import { Router } from 'express';
import {
  getAllCrew,
  createCrewMember,
  updateCrewMember,
  deleteCrewMember,
} from '../controllers/crewController.js';

const router = Router();

router.get('/',       getAllCrew);
router.post('/',      createCrewMember);
router.put('/:id',    updateCrewMember);
router.delete('/:id', deleteCrewMember);

export default router;
