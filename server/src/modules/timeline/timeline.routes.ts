import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getTimeline, getProjectTimeline } from './timeline.controller';

const router = Router();
router.use(authMiddleware);

router.get('/timeline', getTimeline);
router.get('/projects/:pid/timeline', getProjectTimeline);

export default router;
