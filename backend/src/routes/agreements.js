import { Router } from 'express';
import {
  getAllAgreements,
  createAgreement,
  updateAgreement,
  deleteAgreement,
} from '../controllers/agreementsController.js';

const router = Router();

router.get('/',       getAllAgreements);
router.post('/',      createAgreement);
router.put('/:id',    updateAgreement);
router.delete('/:id', deleteAgreement);

export default router;
