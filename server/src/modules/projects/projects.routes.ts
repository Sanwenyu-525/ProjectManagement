import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  updateProjectStatus,
  getProjectStats,
  openProject,
} from './projects.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);
router.patch('/:id/status', updateProjectStatus);
router.get('/:id/stats', getProjectStats);
router.post('/:id/open', openProject);

export default router;
