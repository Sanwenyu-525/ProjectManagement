import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getDocuments, createDocument, getDocumentById, updateDocument, deleteDocument } from './documents.controller';

const router = Router();
router.use(authMiddleware);

router.get('/projects/:pid/documents', getDocuments);
router.post('/projects/:pid/documents', createDocument);
router.get('/documents/:id', getDocumentById);
router.patch('/documents/:id', updateDocument);
router.delete('/documents/:id', deleteDocument);

export default router;
