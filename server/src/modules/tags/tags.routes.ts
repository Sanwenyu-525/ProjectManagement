import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getTags, createTag, updateTag, deleteTag, assignTagToProject, removeTagFromProject } from './tags.controller';

const router = Router();
router.use(authMiddleware);

router.get('/tags', getTags);
router.post('/tags', createTag);
router.patch('/tags/:id', updateTag);
router.delete('/tags/:id', deleteTag);
router.post('/projects/:pid/tags', assignTagToProject);
router.delete('/projects/:pid/tags/:tagId', removeTagFromProject);

export default router;
