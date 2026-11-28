import { Router } from 'express';
import {
  getAllAgreements,
  getAgreementById,
  createAgreement,
  updateAgreement,
  deleteAgreement,
  addAgreementAttachments,
  updateAgreementAttachment,
  deleteAgreementAttachment,
} from '../controllers/agreementsController.js';

const router = Router();

router.get('/',                                      getAllAgreements);
router.get('/:id',                                   getAgreementById);
router.post('/',                                     createAgreement);
router.put('/:id',                                   updateAgreement);
router.delete('/:id',                                deleteAgreement);
router.post('/:id/attachments',                      addAgreementAttachments);
router.put('/:id/attachments/:attachmentId',         updateAgreementAttachment);
router.delete('/:id/attachments/:attachmentId',      deleteAgreementAttachment);

export default router;
