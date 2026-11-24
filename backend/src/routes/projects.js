import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectsController.js';
import {
  getSectionsByProject,
  createSection,
} from '../controllers/sectionsController.js';

const router = Router();

// Project CRUD
router.get('/',     getAllProjects);
router.post('/',    createProject);
router.get('/:id',  getProjectById);
router.put('/:id',  updateProject);
router.delete('/:id', deleteProject);

// Sections nested under a project
router.get('/:projectId/sections',  getSectionsByProject);
router.post('/:projectId/sections', createSection);

export default router;
