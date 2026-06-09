import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getTasks, createTask, updateTask, deleteTask, updateTaskStatus } from './tasks.controller';

const router = Router();
router.use(authMiddleware);

// /api/projects/:pid/tasks
router.get('/projects/:pid/tasks', getTasks);
router.post('/projects/:pid/tasks', createTask);

// /api/tasks/:id
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.patch('/tasks/:id/status', updateTaskStatus);

export default router;
