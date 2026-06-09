import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { globalSearch } from './search.controller';

const router = Router();
router.use(authMiddleware);

router.get('/search', globalSearch);

export default router;
