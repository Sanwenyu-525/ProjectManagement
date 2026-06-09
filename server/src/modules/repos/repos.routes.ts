import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getRepos, addRepo, updateRepo, removeRepo, syncRepo } from './repos.controller';

const router = Router();
router.use(authMiddleware);

router.get('/projects/:pid/repos', getRepos);
router.post('/projects/:pid/repos', addRepo);
router.patch('/repos/:id', updateRepo);
router.delete('/repos/:id', removeRepo);
router.post('/repos/:id/sync', syncRepo);

export default router;
