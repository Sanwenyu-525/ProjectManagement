import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getMilestones, createMilestone, updateMilestone, deleteMilestone } from './milestones.controller';

const router = Router();
router.use(authMiddleware);

router.get('/projects/:pid/milestones', getMilestones);
router.post('/projects/:pid/milestones', createMilestone);
router.patch('/milestones/:id', updateMilestone);
router.delete('/milestones/:id', deleteMilestone);

export default router;
